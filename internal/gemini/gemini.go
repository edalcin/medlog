// Package gemini talks to the Gemini REST API with the standard library only.
//
// It uses models/{model}:generateContent, not the newer Interactions API: the
// extraction is a single stateless call, and Interactions exists to carry
// conversation state we do not have. generateContent remains fully supported.
//
// Structured output is mandatory here (ADR 0008): the response schema is
// declared in Go and sent as generationConfig.responseSchema, so a malformed
// answer is a provider error rather than a parsing surprise. The REST API
// requires camelCase for these fields; snake_case is silently ignored.
package gemini

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// DefaultEndpoint is a format string taking the model name.
	DefaultEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent"

	// PromptVersion and SchemaVersion are stored on every Extraction, so a
	// stored raw response can be reinterpreted later by the exact contract
	// that produced it (ADR 0008). Bump on any change to prompt or schema.
	PromptVersion = "2"
	SchemaVersion = "2"

	// DefaultModel is the cheapest model validated against the reference
	// report. Overridden by app_config.gemini_model (Q13).
	DefaultModel = "gemini-3.1-flash-lite"

	// MaxInlinePDF is the provider limit for base64 inline PDF payloads.
	// Uploads are capped at 10MB elsewhere, so the Files API is not needed.
	MaxInlinePDF = 50 << 20
)

// Client is safe for concurrent use.
type Client struct {
	APIKey string
	HTTP   *http.Client
	// Endpoint overrides DefaultEndpoint; it must contain one %s for the
	// model name. Set by tests to point at a local server.
	Endpoint string
}

func (c *Client) endpoint() string {
	if c.Endpoint != "" {
		return c.Endpoint
	}
	return DefaultEndpoint
}

// New returns a client with a timeout sized for a 16-page report. The call
// runs in a goroutine outside any transaction (ADR 0006), so a long wait
// blocks nothing.
func New(apiKey string) *Client {
	return &Client{APIKey: apiKey, HTTP: &http.Client{Timeout: 5 * time.Minute}}
}

// Indicator is the catalog entry offered to the model. The model may only
// choose among these codes; anything else must come back as unmapped.
type Indicator struct {
	Code string
	Name string
	Unit string
}

// Observation is one measurement as the model reports it. Value is the
// literal text; ValueNum is set only for a number without qualifier.
type Observation struct {
	Code          string   `json:"code"`
	CollectedAt   string   `json:"collectedAt"`
	ValueText     string   `json:"valueText"`
	ValueNum      *float64 `json:"valueNum"`
	Unit          string   `json:"unit"`
	ReferenceText string   `json:"referenceText"`
	RefMin        *float64 `json:"refMin"`
	RefMax        *float64 `json:"refMax"`
	OutOfRange    *bool    `json:"outOfRange"`
	Provenance    string   `json:"provenance"`
}

// Unmapped is an analyte present in the report with no catalog code. It
// becomes a pending decision for an ADMIN, never a silent new Indicator.
type Unmapped struct {
	Label         string `json:"label"`
	CollectedAt   string `json:"collectedAt"`
	ValueText     string `json:"valueText"`
	Unit          string `json:"unit"`
	ReferenceText string `json:"referenceText"`
}

// Result is the whole structured answer.
type Result struct {
	CollectedAt  string        `json:"collectedAt"`
	LabName      string        `json:"labName"`
	ReportNumber string        `json:"reportNumber"`
	Observations []Observation `json:"observations"`
	Unmapped     []Unmapped    `json:"unmapped"`
}

// Usage is the billed cost of the call. Thinking tokens are billed as output,
// so they are added to OutputTokens rather than reported apart.
type Usage struct {
	InputTokens  int
	OutputTokens int
}

// Extract sends the report and returns the raw provider response verbatim
// alongside the parsed result. The raw text is returned even on a parsing
// failure, because it was already paid for and must be persisted (ADR 0006).
func (c *Client) Extract(ctx context.Context, model string, pdf []byte, catalog []Indicator) (raw string, res *Result, usage Usage, err error) {
	if c.APIKey == "" {
		return "", nil, usage, fmt.Errorf("GEMINI_API_KEY não configurada")
	}
	if len(pdf) > MaxInlinePDF {
		return "", nil, usage, fmt.Errorf("PDF de %d bytes excede o limite de envio inline", len(pdf))
	}
	if model == "" {
		model = DefaultModel
	}

	body, err := json.Marshal(request{
		Contents: []content{{
			Role: "user",
			Parts: []part{
				{InlineData: &inlineData{MimeType: "application/pdf", Data: base64.StdEncoding.EncodeToString(pdf)}},
				{Text: prompt(catalog)},
			},
		}},
		GenerationConfig: generationConfig{
			ResponseMIMEType: "application/json",
			ResponseSchema:   responseSchema(),
			Temperature:      0,
		},
	})
	if err != nil {
		return "", nil, usage, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf(c.endpoint(), model), bytes.NewReader(body))
	if err != nil {
		return "", nil, usage, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", c.APIKey)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", nil, usage, err
	}
	defer resp.Body.Close()

	payload, err := io.ReadAll(resp.Body)
	raw = string(payload)
	if err != nil {
		return raw, nil, usage, err
	}
	if resp.StatusCode != http.StatusOK {
		return raw, nil, usage, fmt.Errorf("gemini respondeu %s", resp.Status)
	}

	var envelope response
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return raw, nil, usage, fmt.Errorf("resposta ilegível: %w", err)
	}
	usage = Usage{
		InputTokens:  envelope.UsageMetadata.PromptTokenCount,
		OutputTokens: envelope.UsageMetadata.CandidatesTokenCount + envelope.UsageMetadata.ThoughtsTokenCount,
	}

	text := envelope.text()
	if text == "" {
		return raw, nil, usage, fmt.Errorf("resposta sem conteúdo")
	}
	res = &Result{}
	if err := json.Unmarshal([]byte(text), res); err != nil {
		return raw, nil, usage, fmt.Errorf("conteúdo fora do contrato: %w", err)
	}
	return raw, res, usage, nil
}

// ParseRaw reinterprets a stored raw response without calling the provider.
// This is what makes a parsing fix free: the answer was already paid for.
func ParseRaw(raw string) (*Result, Usage, error) {
	var envelope response
	if err := json.Unmarshal([]byte(raw), &envelope); err != nil {
		return nil, Usage{}, err
	}
	usage := Usage{
		InputTokens:  envelope.UsageMetadata.PromptTokenCount,
		OutputTokens: envelope.UsageMetadata.CandidatesTokenCount + envelope.UsageMetadata.ThoughtsTokenCount,
	}
	text := envelope.text()
	if text == "" {
		return nil, usage, fmt.Errorf("resposta sem conteúdo")
	}
	res := &Result{}
	if err := json.Unmarshal([]byte(text), res); err != nil {
		return nil, usage, err
	}
	return res, usage, nil
}

func prompt(catalog []Indicator) string {
	var b strings.Builder
	b.WriteString(`Você extrai resultados de um laudo laboratorial brasileiro para um registro pessoal de saúde.

Regras, todas obrigatórias:

1. Escolha "code" APENAS na lista de indicadores abaixo. Nunca invente um código. Analito do laudo que não corresponda a nenhum código da lista vai em "unmapped", com o rótulo exato impresso.
2. "valueText" é sempre o texto literal impresso, fiel: ">90", "normais", "----", "5,40", ou o texto morfológico completo. Nunca normalize nem traduza.
3. "valueNum" só é preenchido quando o resultado é um número sem qualificador. ">90" e "normais" têm valueNum nulo. Use ponto decimal: "5,40" tem valueNum 5.40. Separador de milhar do laudo não é decimal: "9.450" tem valueNum 9450.
4. "referenceText" é OBRIGATÓRIO sempre que o laudo imprimir qualquer faixa para aquele resultado, copiado fiel. Só use string vazia quando o laudo realmente não imprime faixa nenhuma para o analito. Atenção ao layout: a coluna "VALORES DE REFERÊNCIA" fica à direita e vale linha a linha — a faixa impressa na mesma linha do resultado é a faixa daquele resultado. Um cabeçalho de condição acima da coluna ("Masc: Maior ou igual a 18 anos") qualifica a coluna inteira e não substitui a faixa da linha; se quiser, inclua os dois no texto, mas nunca devolva a faixa vazia porque existe cabeçalho.
5. A tabela evolutiva tem sua própria coluna "VALORES DE REFERÊNCIA", à direita de todas as colunas de coleta. Essa faixa vale para TODAS as observações daquela linha, uma por coluna de data: repita o mesmo "referenceText" em cada uma.
6. "refMin" e "refMax" são obrigatórios quando a faixa da linha é um intervalo numérico único, como "4,32 a 5,67" ou "70 a 99 mg/dL": preencha 4.32 e 5.67. Deixe nulos quando a faixa é condicional por sexo, idade, jejum, etnia ou risco, quando é aberta ("Superior a 60", "Inferior a 200"), ou quando não é numérica.
7. "outOfRange" é true quando o resultado traz o marcador (1) do laboratório, false quando o laudo indica explicitamente que está na faixa, e nulo quando não há informação. Nunca compare valores por conta própria.
8. "provenance" é "primary" para resultados do corpo do laudo, e "evolutive" para os da tabela comparativa de coletas anteriores, no final do documento.
9. Extraia TODAS as coletas da tabela evolutiva, cada valor como uma observação própria, com o "collectedAt" da sua coluna. Ignore célula com "----": ausência de resultado não é observação.
10. "collectedAt" é sempre a data de coleta, no formato AAAA-MM-DD. Nunca a data de liberação nem a de impressão.
11. "labName" é o laboratório emissor e "reportNumber" é o número da ficha da coleta corrente.
12. O hemograma rende uma observação por sub-analito. Contagem absoluta e percentual são indicadores distintos.

Indicadores disponíveis, no formato code | nome | unidade canônica:
`)
	for _, i := range catalog {
		b.WriteString(i.Code)
		b.WriteString(" | ")
		b.WriteString(i.Name)
		if i.Unit != "" {
			b.WriteString(" | ")
			b.WriteString(i.Unit)
		}
		b.WriteString("\n")
	}
	return b.String()
}

// responseSchema is the Go-declared contract.
//
// Every field of an observation is in "required": the provider documents that
// a field left out of the list "may be excluded by the model to save tokens",
// and that is exactly how the reference range went missing on real reports.
// Optionality is expressed by nullable, never by absence.
//
// Nullability uses the provider convention "nullable": true. The array form
// ("type": ["number", "null"]) and anyOf mixed with siblings are rejected or
// silently mishandled by this API.
func responseSchema() map[string]any {
	nullableNumber := map[string]any{"type": "number", "nullable": true}
	nullableBool := map[string]any{"type": "boolean", "nullable": true}
	str := map[string]any{"type": "string"}

	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"collectedAt":  str,
			"labName":      str,
			"reportNumber": str,
			"observations": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"code":          str,
						"collectedAt":   str,
						"valueText":     str,
						"valueNum":      nullableNumber,
						"unit":          str,
						"referenceText": str,
						"refMin":        nullableNumber,
						"refMax":        nullableNumber,
						"outOfRange":    nullableBool,
						"provenance":    map[string]any{"type": "string", "enum": []string{"primary", "evolutive"}},
					},
					// Every field is required so the model cannot save output tokens by
					// dropping the reference range; nullable ones carry null instead.
					"required": []string{"code", "collectedAt", "valueText", "valueNum", "unit",
						"referenceText", "refMin", "refMax", "outOfRange", "provenance"},
					// Generation order follows the reading order of the report line,
					// so the range is produced right after the value it belongs to.
					"propertyOrdering": []string{"code", "collectedAt", "valueText", "valueNum", "unit",
						"referenceText", "refMin", "refMax", "outOfRange", "provenance"},
				},
			},
			"unmapped": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"label":         str,
						"collectedAt":   str,
						"valueText":     str,
						"unit":          str,
						"referenceText": str,
					},
					"required": []string{"label", "collectedAt", "valueText", "unit", "referenceText"},
				},
			},
		},
		"required": []string{"collectedAt", "observations"},
	}
}

type request struct {
	Contents         []content        `json:"contents"`
	GenerationConfig generationConfig `json:"generationConfig"`
}

type content struct {
	Role  string `json:"role"`
	Parts []part `json:"parts"`
}

type part struct {
	Text       string      `json:"text,omitempty"`
	InlineData *inlineData `json:"inlineData,omitempty"`
}

type inlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

type generationConfig struct {
	ResponseMIMEType string         `json:"responseMimeType"`
	ResponseSchema   map[string]any `json:"responseSchema"`
	Temperature      float64        `json:"temperature"`
}

type response struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
		ThoughtsTokenCount   int `json:"thoughtsTokenCount"`
		TotalTokenCount      int `json:"totalTokenCount"`
	} `json:"usageMetadata"`
}

func (r response) text() string {
	var b strings.Builder
	for _, c := range r.Candidates {
		for _, p := range c.Content.Parts {
			b.WriteString(p.Text)
		}
	}
	return b.String()
}
