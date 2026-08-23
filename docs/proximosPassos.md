# Próximos Passos — MedLog V3.0

Documento de continuidade entre sessões. Registra o que já foi decidido, o que está em aberto e os fatos do repositório levantados, para que uma sessão nova retome sem reinvestigar.

**Última atualização:** 2026-08-23
**Fase atual:** fases 1 a 4 concluídas e verificadas. A v3.0 está funcionalmente completa. **A prova com a API real do Gemini continua pendente de autorização** do usuário (ADR 0005), e é a única coisa que falta.

---

## 1. Objetivo da versão 3.0

Extrair dados de PDFs de exames já registrados no MedLog, por meio de um agente de IA (Gemini), para alimentar tabelas de indicadores de saúde no SQLite existente. O usuário seleciona um PDF por vez. A chave da API entra como variável de ambiente `GEMINI_API_KEY` no Docker, e o modelo é selecionável pela interface administrativa. As tabelas devem aceitar indicadores além dos de exame de sangue, e servir de fonte para relatórios de saúde gerados por IA no futuro.

Documento de origem: `docs/v3/MedLog V3.0.md`.

---

## 2. Decisões fechadas

| # | Decisão | Registro |
|---|---|---|
| Q1 | Catálogo + Observações (`health_indicators` + `health_observations`), em vez de uma tabela por tipo de exame | `docs/adr/0001-catalogo-e-observacoes-para-indicadores-de-saude.md` |
| Q2 | Sem entidade `Coleta`. A Observação carrega `collected_at` e `source_file_id`; o Laudo agrupa | `docs/adr/0002-sem-entidade-coleta-o-laudo-agrupa-observacoes.md` |
| Q3 | Ingerir também o laudo evolutivo, distinguindo `provenance` (`primary` prevalece sobre `evolutive`) | `docs/adr/0003-ingestao-do-laudo-evolutivo-com-procedencia.md` |
| Q4 | Faixa de referência: texto fiel sempre, `ref_min`/`ref_max` só quando inequívocos, `out_of_range` do marcador do laboratório | `docs/adr/0004-faixa-de-referencia-fiel-com-numericos-opcionais.md` |
| Q5 | PDF enviado sem redação da PII; Consentimento de extração por documento; Extração restrita a `ADMIN`, com registro de autor, modelo e custo | `docs/adr/0005-pii-enviada-sem-redacao-com-consentimento-por-documento.md` |
| Q6 | Extração gravada em `extractions` antes da chamada, executada em goroutine fora de transação, resposta bruta persistida, frontend por polling | `docs/adr/0006-extracao-persistida-antes-da-chamada-executada-em-goroutine.md` |
| Q7 | Relatórios de IA ficam fora da v3.0, adiados para v3.1 com grill próprio | esta tabela (decisão de escopo, reversível, sem ADR) |
| Q8 | Catálogo `health_indicators` global, semeado na migração `007`; chave `code` interno mais `unit` canônica; analito não catalogado gera pendência | `docs/adr/0007-catalogo-semeado-com-codigo-interno-como-chave.md` |
| Q9 | Saída estruturada (`responseSchema`), esquema em Go como fonte única, lista plana, `value_text` sempre e `value_num` opcional, `prompt_version` e `schema_version` na Extração | `docs/adr/0008-saida-estruturada-com-esquema-em-go-e-versoes-gravadas.md` |
| Q10 | Observações nascem em Revisão; `ADMIN` confere contra o PDF e confirma ou rejeita em bloco; só então valem | `docs/adr/0009-observacoes-nascem-em-revisao-confirmadas-em-bloco.md` |
| Q11 | Extrair sempre. Cobertura pelo Laudo evolutivo não bloqueia nem avisa; a colisão continua resolvida por Q3. Decidido com base em custo medido, ver seção 6 | esta tabela (decisão reversível, sem ADR) |
| Q12 | A Extração enriquece `files` com `collected_at`, `lab_name` e `report_number`, e sugere `custom_name` só se vazio; nada sobrescreve campo humano, e só grava na confirmação do bloco | `docs/adr/0010-extracao-enriquece-metadados-do-documento.md` |
| Q13 | `gemini_model` em `app_config`, escolhido na aba admin a partir de lista curta declarada em Go, com o custo por Extração ao lado; padrão `gemini-3.1-flash-lite`. `GEMINI_API_KEY` permanece em variável de ambiente | esta tabela (decisão reversível, sem ADR) |
| Q14 | Quatro fases: 1 esquema, 2 extração sem interface, 3 revisão, 4 visualização. A fase 2 é entregável sozinha, provada por endpoint e inspeção do banco | `docs/v3/plano.md` |
| Q15 | Gráfico em SVG escrito à mão, sem biblioteca. Nenhuma dependência nova no frontend | esta tabela (decisão reversível, sem ADR) |

Glossário do domínio em `CONTEXT.md`: Indicador, Observação, Laudo, Data de coleta, Faixa de referência, Procedência, Laudo evolutivo, Extração, Consentimento de extração, Revisão.

---

## 3. Perguntas em aberto

Nenhuma. A fronteira do grill está vazia: Q1 a Q14 fechadas. Perguntas novas surgirão da execução das fases, e de v3.1 (relatórios de IA), que tem grill próprio.

---

## 4. Fatos do repositório (levantados, não presumir de novo)

**Stack e restrições**
- Go 1.24, `chi` v5, `modernc.org/sqlite` v1.37.1 puro Go, `CGO_ENABLED=0`. Imagem final `alpine:3.21`, ~30MB. Qualquer dependência com C está fora.
- Gemini é a **primeira e única dependência de rede externa** do projeto, em `internal/gemini/gemini.go`, escrita só com `net/http` e `encoding/json`. Nenhuma dependência foi somada em nenhuma fase: `go.mod` e `go.sum` estão intocados desde o começo da v3.0.
- Migrações: `goose` v3, SQL embutido via `go:embed` em `internal/migrations/`. Existem `001`–`007`; **a próxima é `008`**.
- `internal/db/db.go`: uma única conexão física (`MaxOpenConns=1`), WAL, `foreign_keys=ON`, `busy_timeout=5000`.
- PKs são UUID TEXT (`google/uuid`). Timestamps `DATETIME` gravados pelo driver com `_time_format=sqlite`, o que produz `YYYY-MM-DD HH:MM:SS+00:00` para todo valor escrito pelo Go. **Formato único importa:** o índice de deduplicação de Observações compara `collected_at` como texto, então um caminho de código que grave em outro formato passa a duplicar em silêncio. Há teste protegendo isso (`TestReview_ReExtractionDoesNotDuplicate`).
- Sem extensão JSON em uso.
- `frontend/src/lib/api.ts`: wrapper `fetch` com `credentials: 'include'` e **timeout de 30s**.
- Frontend Svelte 5 compilado pelo Vite e embutido no binário via `go:embed` (`internal/embed/dist`).

**Multiusuário e autenticação**
- `users.role` com `ADMIN` | `USER`. Middlewares `RequireAuth` e `RequireAdmin` em `internal/auth/middleware.go`.
- Todas as tabelas de domínio têm `user_id` com `ON DELETE CASCADE`. Há compartilhamento familiar.
- Sessões via `alexedwards/scs` com store SQLite.
- `app_config(key TEXT PK, value TEXT)` (migração 003) guarda `session_secret_hash` e, desde a fase 2, `gemini_model`. Credencial nunca entra aqui: `SESSION_SECRET` e `GEMINI_API_KEY` vivem no ambiente, e do primeiro só o hash é gravado.

**Documentos**
- Tabela `files`: `id`, `filename`, `custom_name`, `path`, `mime_type`, `size`, `hash` (SHA256), `thumbnail_path` (coluna existe e nunca é preenchida), `consultation_id`, `professional_id`, `user_id`, `uploaded_at`, e desde a migração `007` também `collected_at`, `lab_name` e `report_number`.
- Arquivos gravados no filesystem em `FILES_PATH` com nome `UUID.ext`. Confirma a convenção do PDF de exemplo.
- Deduplicação por `(user_id, hash)` (migração 006). MIME aceitos: `application/pdf`, `image/png`, `image/jpeg`. Limite de 10MB validado no cliente.
- Endpoints em `internal/handlers/files.go`: `ListMine`, `Upload`, `Serve`, `Update`, `Delete`.
- **Nenhum processamento local de PDF**, nem dependência Go ou npm nesse sentido: o Gemini recebe o PDF nativamente. PyMuPDF foi usado apenas em análise fora do produto, para conferir o laudo sem gastar tokens.

**Domínio existente**
- **Não existe entidade Exame.** Um exame é registrado como `Consultation` com `Files` anexados e categorizados por `FileCategory`.
- Vocabulário misto: Go e SQL em `snake_case` inglês, JSON da API em `camelCase`, rótulos de UI em português.
- Nenhuma entidade de resultado, valor medido ou indicador existe hoje.
- Nenhuma biblioteca de gráficos no frontend. Continua sendo verdade, e é decisão da fase 4.
- Envelope de resposta JSON: `{data, error, ok}`, com helpers `writeJSON` / `writeError` em `internal/handlers/helpers.go`.

**Operação e CI**
- Volume único `./data` com `db/` e `uploads/`. `DATABASE_URL` e `SESSION_SECRET` obrigatórias; `FILES_PATH`, `PORT`, `SESSION_SECURE`, `TRUST_PROXY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` opcionais.
- GitHub Actions publica em `ghcr.io/edalcin/medlog` (linux/amd64). Roda lint, typecheck e build do frontend.
- Existem **14** arquivos `_test.go` (handlers, models e db) que **não rodam no CI**. Os três novos da v3.0 são `internal/db/migrate_test.go`, `internal/handlers/extractions_test.go` e `internal/handlers/review_test.go`.
- Interface admin: `internal/handlers/admin.go` (11 endpoints) e `frontend/src/routes/Admin.svelte`, agora com **10 abas**, incluindo backup, restore e "Extração por IA".
- `npm run check` **não existe** e `svelte-check` **não está instalado**. A verificação de frontend disponível é `npm run build`, que roda o compilador Svelte e reprova runa mal usada. Adicionar `svelte-check` é decisão em aberto, nunca proposta ao usuário como necessária.

---

## 5. Fatos do PDF de referência

Arquivo de teste: `docs/pdfSangue/f39defb0-78a7-46fd-8d1c-96fea29bf841.pdf` (pasta ignorada pelo git, dados sensíveis, nunca enviar ao remoto).

**Informado pelo usuário, não levantado do repositório:** a princípio todos os exames de sangue vêm do mesmo laboratório, a Clínica Felippe Mattoso. O layout do laudo é, portanto, estável, o que favorece o mapeamento para o catálogo de Indicadores. Não é garantia contratual: o desenho continua tolerando laudo de outro laboratório, que cai em pendência em vez de dado errado.

- 16 páginas, cerca de 40 analitos. O hemograma sozinho traz cerca de 20 sub-analitos.
- Valores derivados e calculados: HOMA-IR, eGFR em três equações com variação por etnia, VLDL por fórmula de Martin/Hopkins, glicemia média estimada, relação PSA livre/total.
- Resultados não numéricos que o modelo precisa tolerar: `>90`, `normais`, `----`, e texto morfológico livre.
- Páginas 15 e 16 formam o **laudo evolutivo**: seis coletas anteriores identificadas por data e número de ficha, cobrindo de 2018 a 2025. Datas cobertas neste exemplar: 12/06/2025, 03/12/2024, 25/04/2024, 25/01/2024 e 27/03/2023.
- Marcador `(1)` indica resultado fora da faixa de referência.
- PII presente: nome completo, data de nascimento, número de ficha, médico e CRM, CNES do laboratório, assinaturas digitais.
- Extração de texto local: PyMuPDF lê as 16 páginas sem falha, inclusive a 2 e a 13 (verificado na fase 1). Serve para conferir a extração da IA contra o laudo sem gastar tokens. O Gemini continua recebendo o PDF nativamente.

---

## 6. Custo medido da Extração (não recalcular)

Fontes: `https://ai.google.dev/gemini-api/docs/pricing`, `https://ai.google.dev/gemini-api/docs/document-processing` e `https://ai.google.dev/gemini-api/docs/rate-limits`, consultadas em 2026-08-23, com preços vigentes até 31/12/2026.

- O Gemini cobra **258 tokens por página** de PDF, contadas como imagem. O texto nativo do PDF **não é cobrado**.
- O PDF de referência tem 16 páginas, contadas do arquivo: 4.128 tokens. Com prompt, esquema e catálogo de 40 indicadores, o input fica em torno de 6.100 tokens.
- Saída estimada: cerca de 40 Observações `primary` e cerca de 180 `evolutive`, aproximadamente 9.100 tokens de JSON. Tokens de raciocínio são cobrados como saída.
- Custo de uma Extração, tier pago, considerando raciocínio médio: `gemini-3.1-flash-lite` cerca de US$ 0,021; `gemini-3.5-flash-lite` US$ 0,035; `gemini-3.7-flash` US$ 0,054; `gemini-3.5-flash` US$ 0,127; `gemini-3.1-pro-preview` US$ 0,17.
- O Free Tier zera o custo em dólar e o volume pessoal não chega perto dos limites de RPM, TPM e RPD. Mas no Free Tier o conteúdo é usado para melhorar os produtos do Google, o que colide com Q5. Os números por modelo deixaram de ser publicados na documentação e só aparecem no AI Studio.
- `gemini-3.1-pro-preview` não tem Free Tier.

**Consequência já usada em decisão:** o custo é baixo o bastante para não governar desenho. Foi o que fechou Q11 em "extrair sempre". O que governa a escolha do modelo é privacidade, não preço: tier pago, para que o laudo não entre em treino.

---

## 7. Estado da execução

### Fase 1 — Esquema: **concluída**

Migração `007_health_indicators.sql`, em `internal/migrations/`, com `Up` e `Down`:

- `health_indicators`: catálogo global sem `user_id`, `code` UNIQUE, `unit` canônica.
- `extractions`: `status` em (`pending`, `succeeded`, `failed`), `raw_response`, `input_tokens`, `output_tokens`, `prompt_version`, `schema_version`, `triggered_by`, `consented_at`.
- `health_observations`: `value_text` NOT NULL e `value_num` opcional; `reference_text`, `ref_min`, `ref_max`, `out_of_range`; `provenance` em (`primary`, `evolutive`); `status` em (`review`, `confirmed`). Índice de série em `(user_id, indicator_id, collected_at)` e índice único em `(user_id, indicator_id, collected_at, provenance)`, que é o que dá suporte à substituição de `evolutive` por `primary`.
- `files`: colunas novas `collected_at`, `lab_name`, `report_number`, mais índice em `collected_at`.

**Catálogo semeado: 55 Indicadores**, não os cerca de 40 estimados no grill. A diferença vem do hemograma, que rende contagem absoluta e percentual separadas para cada série branca, e da filtração glomerular, que rende cinco Indicadores distintos (CKD-EPI 2009 afrodescendente e não afrodescendente, CKD-EPI 2021, MDRD afrodescendente e não afrodescendente). Nomes e unidades foram lidos do laudo de referência com PyMuPDF, não presumidos.

Correção de fato: **PyMuPDF extrai as 16 páginas sem falha**, inclusive a 2 e a 13, ao contrário do que a seção 4 registrava. Isso não muda nenhuma decisão — o Gemini continua recebendo o PDF nativamente — mas serve para conferir a extração contra o laudo sem custo em tokens.

**Prova executada:** `go test ./internal/db/ -run TestMigrate007`, em `internal/db/migrate_test.go`, verifica que a migração sobe, que o catálogo tem 55 linhas, que `glucose_serum` tem unidade `mg/dL`, que `homa_ir` é adimensional, que as três colunas novas de `files` existem, que `provenance` inválida é rejeitada pelo CHECK, que o `Down` remove tabelas e colunas, e que o `Up` seguinte funciona. `go build ./...`, `go vet ./...` e `go test ./...` passam por inteiro.

### Fase 2 — Extração: **implementada; prova real pendente de autorização**

Arquivos novos: `internal/gemini/gemini.go`, `internal/models/health.go`, `internal/models/appconfig.go`, `internal/handlers/extractions.go`, `internal/handlers/extractions_test.go`. Rotas registradas em `cmd/medlog/main.go`, todas dentro do grupo `RequireAdmin`.

**Decisão de implementação, registrada aqui porque não estava no grill:** usamos `POST /v1beta/models/{model}:generateContent`, não a Interactions API. A documentação de agosto de 2026 marca `generateContent` como legado mas plenamente suportado, e a Interactions API existe para carregar estado de conversa, que esta chamada não tem. Zero dependência nova: `net/http` e `encoding/json` bastam, então `CGO_ENABLED=0` e o tamanho da imagem continuam intactos.

Fatos da API confirmados na documentação oficial: PDF inline em base64 até 50MB, acima disso Files API; `generationConfig.responseMimeType` e `responseSchema` em camelCase, snake_case é ignorado em silêncio; `usageMetadata` traz `promptTokenCount`, `candidatesTokenCount` e `thoughtsTokenCount` em campos separados, e o raciocínio é cobrado como saída, então o código soma `candidates + thoughts`; `gemini-3.1-flash-lite` não usa raciocínio, e na série 3.x não é possível desligá-lo.

Endpoints: `POST /api/extractions` (exige `consent: true`, devolve 202 com a linha `pending`), `GET /api/extractions/{id}`, `GET /api/extractions/{id}/observations`, `GET /api/files/{id}/extractions`, `GET` e `PUT /api/admin/gemini-model`.

Comportamentos que o código garante, cada um coberto por teste: sem consentimento nada é enviado; a linha nasce antes da chamada; a chamada roda em goroutine com `context.Background()`, para que o cliente desistir não cancele o que já está sendo cobrado; a resposta bruta é gravada antes de qualquer interpretação, e também quando a chamada falha; código fora do catálogo é descartado como pendência e nunca cria Indicador; Observação nasce em `review` e não aparece em série; `ExtractionMarkStale` no arranque marca como falha toda extração `pending`, porque goroutine não sobrevive a reinício; modelo fora da lista curada é rejeitado com 400.

**Prova executada:** `go test ./internal/handlers/ -run TestExtraction`, seis testes, todos passando, contra um provedor falso em `httptest` que devolve o envelope real da API. O teste confere o que vai no fio (PDF inline, `responseSchema`, catálogo no prompt) e o que chega no banco, com um fixture que reproduz os casos difíceis do laudo real: `>90` sem `value_num`, TSH com faixa condicional e sem limites numéricos, valor evolutivo datado de 12/06/2025, `out_of_range` true e false vindos do marcador, e um analito fora do catálogo. Mutação de sanidade: desativar a checagem de consentimento faz o teste correspondente falhar com 202 em vez de 400. `go build ./...`, `go vet ./...` e `go test ./...` passam por inteiro.

**Pendente, e é uma decisão do usuário, não técnica:** a prova definida no plano é extrair o PDF de referência com a chave real. Ela envia o laudo, com nome completo e data de nascimento, ao Google, e gasta cerca de US$ 0,02. O ADR 0005 exige consentimento explícito por documento, e esse consentimento é do usuário. `GEMINI_API_KEY` está presente no ambiente, então basta autorizar.

### Fase 3 — Revisão: **concluída**

Backend: `Review`, `Confirm`, `Reject`, `ListIndicators` e `PromoteIndicator` em `internal/handlers/extractions.go`; `FileApplyExtractedMetadata` em `internal/models/file.go`. Frontend: `frontend/src/routes/ExtractionReview.svelte` (novo), rota `/extractions/:id/review` em `App.svelte`, disparo em `Files.svelte` e aba "Extração por IA" em `Admin.svelte`.

O payload de revisão vem numa só chamada e as pendências e sugestões de metadado são **re-derivadas da resposta bruta** com `gemini.ParseRaw`: nada disso precisou de coluna própria. A guarda de não sobrescrever metadado humano fica no SQL (`COALESCE`/`NULLIF`), não no chamador, então nenhum caminho de código a contorna.

**Mudança com efeito em segurança, registrada aqui de propósito:** `internal/middleware/security.go` passou de `X-Frame-Options: DENY` para `SAMEORIGIN`, com `frame-src 'self'`, `object-src 'self'` e `frame-ancestors 'self'` acrescentados ao CSP. Motivo: a revisão mostra o PDF ao lado dos valores, e `DENY` bloqueia até o enquadramento da própria origem. Enquadramento por terceiro continua bloqueado, que é o que `DENY` de fato protegia.

**Defeitos encontrados e corrigidos durante a verificação, não presumidos:**
- N+1 na lista de documentos: a interface fazia uma chamada por PDF da página, até 20, para saber se havia extração. Resolvido com três subconsultas em `fileSelectSQL` (`extraction_count`, `latest_extraction_id`, `latest_extraction_status`, `review_count`), e o código cliente correspondente foi apagado. De 20 requisições para zero.
- O selo de estado continuava "Aguardando revisão" depois de confirmar. Agora reflete a decisão: Confirmada, Rejeitada, Em andamento ou Falhou.

**Fato do ambiente, não defeito nosso:** o PDF no painel lateral não renderizou no Chrome usado na verificação. Os cabeçalhos e os bytes estão corretos, comprovados por `fetch`: 200, `application/pdf`, 207.179 bytes, começando em `%PDF-1.5`, com `X-Frame-Options: SAMEORIGIN`. Navegar direto para o PDF fez o Chrome baixar o arquivo em vez de exibir, o que desanexou a aba. [INFERENCE] O navegador está configurado para baixar PDFs em vez de abri-los. A tela já oferece "Abrir o documento em outra aba" como alternativa.

**Prova executada:** `go test ./internal/handlers/ -run TestReview`, cinco testes, incluindo o que garante que confirmar **não** sobrescreve metadado digitado por humano e ainda preenche o campo vazio, e o que garante que reextrair a mesma coleta **substitui em vez de duplicar** — este último protege a chave única de ADR 0003, que compara data como texto e só vale enquanto todo datetime é gravado num único formato. Verificação visual com a aplicação de verdade rodando: login, lista de documentos mostrando "1 extração / aguardando revisão", diálogo de consentimento com os quatro pontos, tela de revisão com as três regras difíceis honradas (`>90` marcado como não numérico, `faixa não informada` distinta de `dentro da faixa`, linha evolutiva distinta da primária), confirmação em bloco pela interface promovendo 8 Observações e gravando os 4 metadados, e a série de glicose passando a existir de 2024 a 2026. Aba admin verificada nos dois estados, com e sem `GEMINI_API_KEY`, para conferir o aviso de chave ausente. `go build ./...`, `go vet ./...`, `go test ./...` e `npm run build` passam.

### Fase 4 — Visualização: **concluída**

Backend: `IndicatorSeriesIndex` em `internal/models/health.go` e `internal/handlers/series.go` (`SeriesHandler`), com `GET /api/health-series` e `GET /api/health-series/{code}`. São as **primeiras rotas da v3.0 fora de `RequireAdmin`**: ler o próprio indicador é uso comum, e o escopo é sempre o usuário da sessão — o compartilhamento familiar cobre profissionais e clínicas, nunca resultado de exame. `ObservationFindSeries`, escrita na fase 2 e até então sem chamador, passou a ser usada.

Frontend: `frontend/src/routes/HealthSeries.svelte`, rota `/indicators` em `App.svelte`, link "Indicadores" em `Navigation.svelte` (desktop e mobile), e `getSeriesIndex` / `getSeries` em `lib/api.ts`.

**Q15, decidida na execução:** o gráfico é SVG escrito à mão dentro do próprio componente, cerca de 60 linhas de geometria. Nenhuma biblioteca entrou, então `package.json` continua intocado desde o começo da v3.0, como `go.mod`. Escalas linear em tempo e em valor, banda de referência como um `<rect>`, linha como `<polyline>`, pontos como `<circle>` com `<title>` nativo servindo de tooltip — zero JavaScript de interação.

Regras do plano honradas e verificadas na tela: só Observação `confirmed` aparece; ponto `evolutive` é vazado e o `primary` é sólido; `out_of_range` pinta o ponto de vermelho; Observação sem `value_num` fica só na lista e não no gráfico; a faixa é desenhada apenas quando `ref_min` **e** `ref_max` existem — HDL, que só tem "Superior a 40", não ganha banda, como esperado.

**Decisão de desenho que vale registrar:** a faixa desenhada é a da coleta mais recente que traz os dois limites, não uma por ponto. Faixa condicional (TSH por idade) muda entre coletas; uma banda só é honesta o bastante e evita um polígono que ninguém pediu. Está marcado no código com comentário `ponytail:`.

**Prova executada:** `go test ./internal/handlers/ -run TestSeries`, que verifica que Observação em Revisão não existe na série nem no índice, que o dado de outro usuário não vaza, que a ordem é por Data de coleta crescente, que a procedência sobrevive ao caminho todo, e que indicador sem dado confirmado responde vazio em vez de erro. Verificação visual com a aplicação de verdade rodando em `:3399`, com base semeada com cinco medidas de glicose de 2018 a 2026 (quatro `evolutive`, uma `primary`, duas fora da faixa), duas de HDL e uma não numérica: o gráfico saiu com a banda 70–99, os pontos vazados, os dois pontos vermelhos e a tabela de medidas coerente. `go build ./...`, `go vet ./...`, `go test ./...` e `npm run build` passam.

### Documentação de usuário e deploy: **atualizada**

Lacuna encontrada depois da fase 4 e corrigida: **`GEMINI_API_KEY` não estava documentada em lugar nenhum**. Quem subisse a imagem nova não tinha como saber que variável acrescentar. Agora consta em `.env.example`, `docker-compose.yml`, `README.md`, `TECHNICAL.md`, `UNRAID.md` e `CLAUDE.md`, sempre marcada como **opcional** e com o aviso de usar tier pago, porque o Free Tier põe o laudo em treino e isso colide com Q5.

Na mesma passada: `README.md` ganhou o bloco de funcionalidades da v3.0 e um guia de cinco passos para extrair um laudo; `TECHNICAL.md` saiu de "v2" para "v3", com as três tabelas novas no schema, as rotas de extração e de série, a seção de extração por IA (fluxo, cliente Gemini, catálogo, privacidade) e a cobertura de testes real, incluindo o aviso de que os testes não rodam no CI; `UNRAID.md` ganhou o aviso de backup antes de atualizar, a nota da migração `007` e dois casos de troubleshooting (chave ausente e PDF que não renderiza no `<iframe>`).

Cada decisão nova deve, na mesma sessão: atualizar `CONTEXT.md` se criar ou alterar um termo, gerar ADR em `docs/adr/` se for difícil de reverter, e atualizar este arquivo. Commit sempre em `main`, branch único.

---

## 8. Como retomar numa sessão nova

**Onde o trabalho está:** branch `main`, working tree limpo.

| Commit | Conteúdo |
|---|---|
| `9b02108` | grill fechado, ADRs 0004–0010, plano faseado |
| `1568d72` | fase 1: migração `007`, catálogo com 55 Indicadores |
| `014036c` | fase 2: cliente Gemini, endpoints, interpretação em Revisão |
| `86ff55a` | fase 3: tela de revisão, confirmar/rejeitar, aba admin, correção de N+1 |
| `893c83c` | continuidade atualizada para retomada da fase 4 |
| `cfa4abf` | fase 4: série temporal, gráfico SVG sem dependência |
| `(esta sessão)` | documentação de usuário e deploy alinhada à v3.0, `GEMINI_API_KEY` documentada |

**Reproduzir a verificação inteira, sem gastar token nenhum:**

```
go build ./... && go vet ./... && go test ./... -count=1
cd frontend && npm run build
```

**Subir a aplicação de verdade para olhar a interface:** binário com `DATABASE_URL`, `SESSION_SECRET`, `FILES_PATH`, `PORT`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. A extração aponta para documento **já existente** no sistema, anexado pelo fluxo normal de arquivos: não há upload no caminho de extração. O disparo fica na lista de documentos, só para `ADMIN` e só para PDF, atrás do diálogo de consentimento.

### A decisão esperando o usuário

**Autorizar a chamada real ao Gemini.** É a prova que falta da fase 2, definida no plano, e a única pendência da v3.0. Envia o laudo de referência, com nome completo e data de nascimento, ao Google, e gasta cerca de US$ 0,02. `GEMINI_API_KEY` estava presente no ambiente da sessão anterior. Sem essa autorização, a fase 2 permanece provada apenas contra provedor falso — o que cobre contrato, persistência e interpretação, mas não a qualidade real do mapeamento do modelo.

**Defeito encontrado no primeiro uso real (2026-08-23), já corrigido:** com `gemini-3.7-flash`, o laudo voltou sem nenhuma faixa de referência — nem no hemograma, onde ela é impressa em coluna à direita, nem na tabela evolutiva, que tem coluna própria. O mapeamento não tinha culpa: repassa `referenceText` intacto. A causa é a documentada pelo provedor — campo ausente de `required` pode ser omitido pelo modelo para poupar tokens. Correções, todas em `prompt`/`schema` versão `2`: todo campo da observação passou a `required`, nulidade migrou de `anyOf` para `"nullable": true`, o prompt ganhou regra explícita sobre a coluna de referência (vale linha a linha, e na tabela evolutiva vale para todas as colunas de coleta) e sobre preencher `refMin`/`refMax` em intervalo único. Além disso, `deriveRange` em `internal/handlers/extractions.go` lê os limites do texto literal quando o modelo os deixa nulos, recusando faixa condicional. Na interface, o selo "faixa não informada" virou "sem marcador": ele sempre falou do marcador `(1)` do laboratório, nunca da faixa, e a redação confundia.

**Segundo defeito do uso real, também corrigido:** extrações se acumulavam. Reextrair o mesmo documento deixava as Observações da tentativa anterior paradas em revisão — as que a nova resposta não repetiu —, então o documento continuava marcado como "aguardando revisão" mesmo depois de confirmar o bloco novo, e a lista mostrava "2 extrações". Agora **um documento guarda uma extração**: ao terminar, a nova apaga as anteriores daquele documento e o que elas tinham deixado em revisão. Observação já confirmada sobrevive, porque `extraction_id` é `ON DELETE SET NULL`. Somado a isso, `DELETE /api/files/{id}/extractions` (link **zerar** na lista de documentos) apaga extrações e Observações daquele documento, confirmadas inclusive, para recomeçar do zero com outro modelo. Dois testes com mutação conferida: `TestReview_NewExtractionSupersedesLeftoverReview` e `TestReview_ResetFileStartsFromScratch`.

**Fato do desenho que apareceu ao escrever o teste, vale saber:** a chave única de Observação é `(user_id, indicator_id, collected_at, provenance)` e **ignora o documento**. Dois PDFs que cubram a mesma coleta do mesmo indicador compartilham uma linha só, e a extração mais recente vence. É o que ADR 0003 quis, mas surpreende quem espera uma linha por documento.

**Terceiro defeito do uso real, corrigido:** o laudo imprime o marcador de alteração colado ao número — `9.000(1)` — e o modelo devolveu esses resultados sem `valueNum`. Quatro das seis coletas de leucócitos caíram na lista de "não numéricos" em vez do gráfico. Junto veio um erro pior, este nosso: `deriveRange` lia `3.650` como três vírgula seiscentos e cinquenta, porque tratava o ponto como decimal. A faixa de referência de leucócitos apareceu como 3,65–8,12, mil vezes menor, e arrastou o eixo do gráfico para valores negativos. Agora `parseNumberBR` segue a convenção brasileira — ponto agrupa milhar, vírgula abre decimal —, `deriveValue` recupera o número descartando o marcador, e o marcador passou a responder `out_of_range` quando o modelo o deixa nulo. Prompt na versão `3` explica o marcador ao modelo. Verificado na tela com a série real de leucócitos: seis pontos no gráfico, faixa 3.650–8.120 desenhada, quatro pontos vermelhos, nenhuma seção de "não numéricos".

**Mudança de permissão pedida pelo usuário (ADR 0011):** a extração deixou de ser exclusiva de `ADMIN`. Qualquer usuário extrai, revisa e confirma os próprios documentos; o `ADMIN` alcança os de todos. Documento ou extração alheia responde **404**, nunca 403. Seguem restritos a `ADMIN`: promover analito ao catálogo (é global) e escolher o modelo (é configuração de servidor). O ADR 0005 ficou marcado como parcialmente superado — PII sem redação e consentimento por documento continuam valendo. Teste novo `TestExtraction_UserExtractsOwnDocument`, com mutação conferida, e verificação com usuária comum na aplicação real: sem link de Admin, com botão de extrair no próprio PDF, 404 no documento do outro e 403 na configuração de modelo.

Depois disso, a v3.1 (relatórios de saúde gerados por IA) tem grill próprio, ainda não iniciado.

### Armadilhas que já custaram tempo, para não repetir

- `ALTER TABLE ... DROP COLUMN` falha se a coluna estiver indexada: no `Down` da `007`, o índice é dropado antes. SQLite embutido é 3.49.2, folgado para `DROP COLUMN` (3.35+).
- `responseSchema` e `responseMimeType` precisam ir em camelCase; em snake_case a API ignora **em silêncio** e devolve texto livre.
- Campo fora de `required` no `responseSchema` **é descartado pelo modelo para poupar tokens de saída** — está na documentação do provedor. Foi assim que a faixa de referência sumiu num laudo real, com `gemini-3.7-flash`: o layout imprime a faixa em coluna à direita, e o modelo tratou o campo opcional como dispensável. Desde o prompt/schema `2`, **todo** campo da observação é obrigatório; o que pode faltar vai como `null`.
- Nulidade no `responseSchema` vai como `"nullable": true`, convenção do provedor. `anyOf` misturado com irmãos e `"type": ["number","null"]` dão 400 ou comportamento silenciosamente errado.
- Faixa impressa não vira automaticamente `ref_min`/`ref_max`: `deriveRange` lê o intervalo do texto literal e **recusa** qualquer coisa condicional (sexo, idade, jejum, etnia, risco) ou aberta. É transcrição, não cálculo — ADR 0004 continua valendo.
- Tokens de raciocínio são cobrados como saída e vêm em `thoughtsTokenCount`, separado de `candidatesTokenCount`. Somar os dois, ou o custo aparece menor do que é.
- A resposta bruta é gravada **antes** de interpretar, inclusive quando a chamada falha. Corrigir parsing nunca deve custar uma nova chamada: use `gemini.ParseRaw`.
- Extração `pending` encontrada no arranque é chamada perdida, não progresso: `ExtractionMarkStale` a marca como falha.
- O PDF pode não renderizar no `<iframe>` se o navegador estiver configurado para baixar PDFs. Não é defeito do servidor; a tela oferece abrir em outra aba.
