package db

import (
	"testing"
)

// TestMigrate009SeedsNormalRanges guarda as invariantes do seed de Faixa de
// normalidade. São invariantes de dado, não de esquema: o CHECK e a chave
// estrangeira já cobrem o esquema, e nada disso pega uma linha semeada com
// código errado ou uma faixa que nunca vai desempatar.
func TestMigrate009SeedsNormalRanges(t *testing.T) {
	database := SetupTestDB(t)

	var rows int
	if err := database.QueryRow("SELECT COUNT(*) FROM indicator_normal_ranges").Scan(&rows); err != nil {
		t.Fatalf("contar indicator_normal_ranges: %v", err)
	}
	if rows != 78 {
		t.Errorf("faixas semeadas = %d, want 78", rows)
	}

	// Código escrito errado no INSERT viraria indicator_id NULL, porque o
	// valor vem de subconsulta. A coluna é NOT NULL, então a migração
	// falharia — mas se algum dia virar nullable, este teste é a rede.
	var orphans int
	if err := database.QueryRow(`
SELECT COUNT(*) FROM indicator_normal_ranges r
LEFT JOIN health_indicators i ON i.id = r.indicator_id
WHERE i.id IS NULL`).Scan(&orphans); err != nil {
		t.Fatalf("procurar faixa órfã: %v", err)
	}
	if orphans != 0 {
		t.Errorf("%d faixas sem Indicador correspondente", orphans)
	}

	// Todo Indicador do catálogo tem pelo menos uma linha, mesmo que sem
	// número: "não há faixa publicada" é resposta, e é diferente de silêncio.
	var uncovered int
	if err := database.QueryRow(`
SELECT COUNT(*) FROM health_indicators i
WHERE NOT EXISTS (SELECT 1 FROM indicator_normal_ranges r WHERE r.indicator_id = i.id)`).Scan(&uncovered); err != nil {
		t.Fatalf("procurar Indicador sem faixa: %v", err)
	}
	if uncovered != 0 {
		t.Errorf("%d Indicadores do catálogo ficaram sem nenhuma linha de faixa", uncovered)
	}

	// Fonte é obrigatória por decisão, não só por NOT NULL: string vazia
	// passaria pelo NOT NULL e mataria a rastreabilidade que a ADR 0015 quis.
	var sourceless int
	if err := database.QueryRow(
		"SELECT COUNT(*) FROM indicator_normal_ranges WHERE TRIM(source) = '' OR TRIM(text) = ''").Scan(&sourceless); err != nil {
		t.Fatalf("procurar faixa sem fonte: %v", err)
	}
	if sourceless != 0 {
		t.Errorf("%d faixas com texto ou fonte em branco", sourceless)
	}

	// Faixa invertida (min acima de max) desenharia um retângulo negativo.
	// Foi exatamente o tipo de erro que a coluna trocada de amilase e lipase
	// teria causado se as duas linhas do documento fossem semeadas cruas.
	var inverted int
	if err := database.QueryRow(
		"SELECT COUNT(*) FROM indicator_normal_ranges WHERE min IS NOT NULL AND max IS NOT NULL AND min >= max").Scan(&inverted); err != nil {
		t.Fatalf("procurar faixa invertida: %v", err)
	}
	if inverted != 0 {
		t.Errorf("%d faixas com min maior ou igual a max", inverted)
	}
	// Amilase e lipase saíram em duas linhas no documento de pesquisa, uma
	// para cada limite, e com as colunas trocadas. Aqui têm de ser uma linha só.
	for _, want := range []struct {
		code     string
		min, max float64
	}{{"amylase", 28, 100}, {"lipase", 13, 60}} {
		var n int
		var min, max float64
		if err := database.QueryRow(`
SELECT COUNT(*), MIN(r.min), MIN(r.max) FROM indicator_normal_ranges r
JOIN health_indicators i ON i.id = r.indicator_id WHERE i.code = ?`, want.code).Scan(&n, &min, &max); err != nil {
			t.Fatalf("consultar %s: %v", want.code, err)
		}
		if n != 1 || min != want.min || max != want.max {
			t.Errorf("%s = %d linha(s) %v–%v, want 1 linha %v–%v", want.code, n, min, max, want.min, want.max)
		}
	}

	// Duas linhas de igual especificidade que sirvam ao mesmo perfil dariam
	// empate permanente, e nenhuma banda desenhada — o defeito silencioso que
	// semear a pesquisa crua teria causado em vitamina D e TSH.
	rowsQ, err := database.Query(`
SELECT i.code,
       CASE WHEN r.sex IS NULL THEN 0 ELSE 1 END
     + CASE WHEN r.age_min IS NULL AND r.age_max IS NULL THEN 0 ELSE 1 END AS spec,
       COALESCE(r.sex, '*'), COALESCE(r.age_min, 0), COALESCE(r.age_max, 200)
FROM indicator_normal_ranges r
JOIN health_indicators i ON i.id = r.indicator_id`)
	if err != nil {
		t.Fatalf("listar faixas: %v", err)
	}
	defer rowsQ.Close()

	type band struct {
		spec           int
		sex            string
		ageMin, ageMax int
	}
	byCode := map[string][]band{}
	for rowsQ.Next() {
		var code, sex string
		var spec, ageMin, ageMax int
		if err := rowsQ.Scan(&code, &spec, &sex, &ageMin, &ageMax); err != nil {
			t.Fatalf("ler faixa: %v", err)
		}
		byCode[code] = append(byCode[code], band{spec, sex, ageMin, ageMax})
	}
	if err := rowsQ.Err(); err != nil {
		t.Fatalf("iterar faixas: %v", err)
	}

	for code, bands := range byCode {
		for _, sex := range []string{"M", "F"} {
			for age := 18; age <= 100; age++ {
				best, hits := -1, 0
				for _, b := range bands {
					if b.sex != "*" && b.sex != sex {
						continue
					}
					if age < b.ageMin || age > b.ageMax {
						continue
					}
					if b.spec > best {
						best, hits = b.spec, 1
					} else if b.spec == best {
						hits++
					}
				}
				if hits > 1 {
					t.Errorf("%s empata com %d faixas de mesma especificidade para sexo %s e idade %d: nunca desenharia banda",
						code, hits, sex, age)
					break
				}
			}
		}
	}
}
