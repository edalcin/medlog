package models_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/google/uuid"

	appdb "medlog/internal/db"
	"medlog/internal/models"
)

func str(s string) *string   { return &s }
func integer(i int) *int     { return &i }
func flt(f float64) *float64 { return &f }

// seedRange insere uma faixa para um Indicador do catálogo semeado pela 007.
// O catálogo nunca é criado pelo teste: IndicatorCreate colidiria com o seed.
func seedRange(t *testing.T, database *sql.DB, code string, r models.NormalRange) {
	t.Helper()
	var indicatorID string
	if err := database.QueryRow(`SELECT id FROM health_indicators WHERE code = ?`, code).Scan(&indicatorID); err != nil {
		t.Fatalf("indicador %q: %v", code, err)
	}
	if _, err := database.Exec(
		`INSERT INTO indicator_normal_ranges (id, indicator_id, sex, age_min, age_max, min, max, text, source)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.New().String(), indicatorID, r.Sex, r.AgeMin, r.AgeMax, r.Min, r.Max, r.Text, r.Source); err != nil {
		t.Fatalf("inserir faixa: %v", err)
	}
}

// Sexo conhecido descarta a linha do outro sexo e sobra uma só: banda desenhável.
func TestNormalRangeResolve_SexPicksOneRow(t *testing.T) {
	database := appdb.SetupTestDB(t)
	ctx := context.Background()

	seedRange(t, database, "hemoglobin", models.NormalRange{
		Sex: str("M"), Min: flt(13.0), Max: flt(16.5), Text: "13,0 a 16,5 g/dL", Source: "Fleury"})
	seedRange(t, database, "hemoglobin", models.NormalRange{
		Sex: str("F"), Min: flt(11.5), Max: flt(15.0), Text: "11,5 a 15,0 g/dL", Source: "Fleury"})

	res, err := models.NormalRangeResolve(ctx, database, "hemoglobin", str("M"), str("1980-05-15"))
	if err != nil {
		t.Fatalf("NormalRangeResolve: %v", err)
	}
	if !res.Resolved || len(res.Candidates) != 1 {
		t.Fatalf("resolved = %v com %d candidatas, want true com 1", res.Resolved, len(res.Candidates))
	}
	if got := *res.Candidates[0].Min; got != 13.0 {
		t.Errorf("min = %v, want 13.0 (a faixa de mulher não pode vencer para sexo M)", got)
	}
	if res.AgeYears == nil || *res.AgeYears < 40 {
		t.Errorf("ageYears = %v, want a idade de hoje para nascimento em 1980", res.AgeYears)
	}
}

// Perfil sem sexo não desempatha: as duas candidatas voltam e a tela não
// desenha banda (Q27). É o caso que justifica o aviso com link para /config.
func TestNormalRangeResolve_UnknownSexKeepsBothCandidates(t *testing.T) {
	database := appdb.SetupTestDB(t)
	ctx := context.Background()

	seedRange(t, database, "hemoglobin", models.NormalRange{
		Sex: str("M"), Min: flt(13.0), Max: flt(16.5), Text: "13,0 a 16,5 g/dL", Source: "Fleury"})
	seedRange(t, database, "hemoglobin", models.NormalRange{
		Sex: str("F"), Min: flt(11.5), Max: flt(15.0), Text: "11,5 a 15,0 g/dL", Source: "Fleury"})

	res, err := models.NormalRangeResolve(ctx, database, "hemoglobin", nil, nil)
	if err != nil {
		t.Fatalf("NormalRangeResolve: %v", err)
	}
	if res.Resolved {
		t.Error("resolved = true sem sexo no perfil; escolher uma das duas seria inventar")
	}
	if len(res.Candidates) != 2 {
		t.Errorf("%d candidatas, want 2", len(res.Candidates))
	}
	if res.AgeYears != nil {
		t.Errorf("ageYears = %v, want nil sem data de nascimento", *res.AgeYears)
	}
}

// A linha que nomeia sexo ou idade vence a linha genérica que também serve.
func TestNormalRangeResolve_MostSpecificWins(t *testing.T) {
	database := appdb.SetupTestDB(t)
	ctx := context.Background()

	seedRange(t, database, "tsh", models.NormalRange{
		Min: flt(0.55), Max: flt(4.78), Text: "0,55 a 4,78 mUI/L", Source: "Fleury, adulto"})
	seedRange(t, database, "tsh", models.NormalRange{
		AgeMin: integer(70), Min: flt(0.4), Max: flt(6.0), Text: "0,40 a 6,00 mUI/L", Source: "Fleury, idoso"})

	// Aos 45 a faixa de idoso não serve: sobra a genérica.
	res, err := models.NormalRangeResolve(ctx, database, "tsh", str("M"), str("1980-05-15"))
	if err != nil {
		t.Fatalf("NormalRangeResolve: %v", err)
	}
	if !res.Resolved || *res.Candidates[0].Max != 4.78 {
		t.Errorf("aos 45 anos: candidatas = %+v, want só a faixa de adulto", res.Candidates)
	}

	// Aos 80 as duas servem, e a que nomeia idade é mais específica.
	res, err = models.NormalRangeResolve(ctx, database, "tsh", str("M"), str("1940-05-15"))
	if err != nil {
		t.Fatalf("NormalRangeResolve: %v", err)
	}
	if !res.Resolved || *res.Candidates[0].Max != 6.0 {
		t.Errorf("aos 85 anos: candidatas = %+v, want a faixa de idoso", res.Candidates)
	}
}

// Indicador sem faixa cadastrada responde vazio, não erro: a tela diz "não
// cadastrada" e nunca deixa a IA preencher (Q29).
func TestNormalRangeResolve_NoRangeIsEmptyNotError(t *testing.T) {
	database := appdb.SetupTestDB(t)

	res, err := models.NormalRangeResolve(context.Background(), database, "homa_ir", str("M"), str("1980-05-15"))
	if err != nil {
		t.Fatalf("NormalRangeResolve: %v", err)
	}
	if res.Resolved || len(res.Candidates) != 0 {
		t.Errorf("resolved = %v com %d candidatas, want false com 0", res.Resolved, len(res.Candidates))
	}
}

// Faixa sem limites numéricos existe: é texto de meta clínica, não banda. O
// gráfico não desenha, o parágrafo mostra (caso do LDL, meta por risco).
func TestNormalRangeResolve_TextOnlyRangeHasNoBand(t *testing.T) {
	database := appdb.SetupTestDB(t)

	seedRange(t, database, "ldl_cholesterol", models.NormalRange{
		Text:   "Meta definida por risco cardiovascular",
		Source: "Diretriz SBC 2025",
	})
	res, err := models.NormalRangeResolve(context.Background(), database, "ldl_cholesterol", str("M"), str("1980-05-15"))
	if err != nil {
		t.Fatalf("NormalRangeResolve: %v", err)
	}
	if !res.Resolved || len(res.Candidates) != 1 {
		t.Fatalf("resolved = %v com %d candidatas, want true com 1", res.Resolved, len(res.Candidates))
	}
	if res.Candidates[0].Min != nil || res.Candidates[0].Max != nil {
		t.Error("faixa só de texto não pode trazer limites numéricos")
	}
}
