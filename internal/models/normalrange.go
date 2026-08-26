package models

import (
	"context"
	"database/sql"
	"time"
)

// NormalRange é uma linha de indicator_normal_ranges. Faixa de normalidade é
// conceito distinto da Faixa de referência impressa no Laudo (ADR 0015): esta
// vem de fonte citável e depende de Característica do usuário, aquela é
// transcrição do papel.
//
// Sex, AgeMin e AgeMax nulos significam "qualquer". Min e Max nulos significam
// "sem banda para desenhar": a faixa existe como texto, mas não como número —
// é o caso de LDL, cuja meta a SBC define por risco cardiovascular.
type NormalRange struct {
	Sex    *string  `json:"sex,omitempty"`
	AgeMin *int     `json:"ageMin,omitempty"`
	AgeMax *int     `json:"ageMax,omitempty"`
	Min    *float64 `json:"min,omitempty"`
	Max    *float64 `json:"max,omitempty"`
	Text   string   `json:"text"`
	Source string   `json:"source"`
}

// specificity conta quantas Características do usuário a linha restringe. A
// linha que restringe mais vence a que restringe menos: uma faixa de homem
// adulto é mais precisa que uma faixa "qualquer pessoa".
func (r NormalRange) specificity() int {
	n := 0
	if r.Sex != nil {
		n++
	}
	if r.AgeMin != nil || r.AgeMax != nil {
		n++
	}
	return n
}

// NormalRangeResolution é o resultado de casar o catálogo de faixas contra o
// perfil de quem está olhando a tela.
//
// Resolved só é verdadeiro quando sobrou exatamente uma candidata. Empate
// significa que o perfil não desempatou — sexo biológico ou nascimento em
// branco, por exemplo —, e nesse caso a tela lista todas as candidatas e não
// desenha banda nenhuma, em vez de escolher uma por conta própria (Q27).
type NormalRangeResolution struct {
	Candidates []NormalRange `json:"candidates"`
	Resolved   bool          `json:"resolved"`
	// Idade em anos completos hoje, quando o nascimento é conhecido. A faixa
	// é resolvida pela idade de hoje, não pela idade na Data de coleta: só há
	// usuários adultos, e a banda do gráfico é um retângulo.
	// ponytail: vira polígono em degraus quando entrar série de criança, em
	// que a faixa muda ao longo da própria série.
	AgeYears *int `json:"ageYears,omitempty"`
}

// ageYearsAt devolve a idade em anos completos entre birthDate ("AAAA-MM-DD")
// e a data de referência. Data ilegível devolve nil: idade desconhecida é
// tratada como perfil incompleto, nunca como zero.
func ageYearsAt(birthDate string, at time.Time) *int {
	b, err := time.Parse("2006-01-02", birthDate)
	if err != nil {
		return nil
	}
	years := at.Year() - b.Year()
	// Aniversário ainda não chegou este ano: desconta um.
	if at.Month() < b.Month() || (at.Month() == b.Month() && at.Day() < b.Day()) {
		years--
	}
	if years < 0 {
		return nil
	}
	return &years
}

// NormalRangeResolve casa as faixas cadastradas de um Indicador contra o sexo
// biológico e a idade de hoje de um usuário, e devolve a linha mais específica
// que serve. Sem faixa cadastrada devolve Candidates vazio: a tela diz "não
// cadastrada" em vez de inventar (Q29).
//
// Característica desconhecida não filtra nada: se o sexo está em branco, tanto
// a linha de homem quanto a de mulher continuam candidatas, o empate sobrevive
// e a banda não é desenhada.
func NormalRangeResolve(ctx context.Context, db *sql.DB, indicatorCode string, sex, birthDate *string) (*NormalRangeResolution, error) {
	rows, err := db.QueryContext(ctx, `
SELECT r.sex, r.age_min, r.age_max, r.min, r.max, r.text, r.source
FROM indicator_normal_ranges r
JOIN health_indicators i ON i.id = r.indicator_id
WHERE i.code = ?
ORDER BY r.sex NULLS FIRST, r.age_min NULLS FIRST`, indicatorCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var all []NormalRange
	for rows.Next() {
		var r NormalRange
		if err := rows.Scan(&r.Sex, &r.AgeMin, &r.AgeMax, &r.Min, &r.Max, &r.Text, &r.Source); err != nil {
			return nil, err
		}
		all = append(all, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	res := &NormalRangeResolution{Candidates: []NormalRange{}}
	if birthDate != nil {
		res.AgeYears = ageYearsAt(*birthDate, time.Now().UTC())
	}

	// Filtra o que o perfil sabe descartar. O que ele não sabe, não descarta.
	var fits []NormalRange
	for _, r := range all {
		if sex != nil && r.Sex != nil && *r.Sex != *sex {
			continue
		}
		if res.AgeYears != nil {
			if r.AgeMin != nil && *res.AgeYears < *r.AgeMin {
				continue
			}
			if r.AgeMax != nil && *res.AgeYears > *r.AgeMax {
				continue
			}
		}
		fits = append(fits, r)
	}
	if len(fits) == 0 {
		return res, nil
	}

	// Entre as que servem, só as mais específicas seguem: a faixa genérica
	// perde da que nomeia sexo ou idade.
	best := 0
	for _, r := range fits {
		if s := r.specificity(); s > best {
			best = s
		}
	}
	for _, r := range fits {
		if r.specificity() == best {
			res.Candidates = append(res.Candidates, r)
		}
	}
	res.Resolved = len(res.Candidates) == 1
	return res, nil
}
