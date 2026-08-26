# Próximos Passos — MedLog V3.0

Documento de continuidade entre sessões. Registra o que já foi decidido, o que está em aberto e os fatos do repositório levantados, para que uma sessão nova retome sem reinvestigar.

**Última atualização:** 2026-08-26 (segunda sessão do dia)
**Fase atual:** v3.0 em uso real; ciclo **v3.1 — Faixa de normalidade e gráfico interativo** em execução. Trinta e uma decisões fechadas (Q1 a Q31), ADRs `0001` a `0015`. A verificação visual pendente **foi feita** e achou dois defeitos, já corrigidos. A resolução da Faixa de normalidade **está implementada**. **Falta só o dado clínico: o usuário revisa `docs/faixas/*.md` e a migração `009` semeia.**

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
| Q5 | PDF enviado sem redação da PII; Consentimento de extração por documento; registro de autor, modelo e custo. A restrição a `ADMIN` **caiu** (ver Q17) | `docs/adr/0005-pii-enviada-sem-redacao-com-consentimento-por-documento.md`, revisto por `0011` |
| Q6 | Extração gravada em `extractions` antes da chamada, executada em goroutine fora de transação, resposta bruta persistida, frontend por polling | `docs/adr/0006-extracao-persistida-antes-da-chamada-executada-em-goroutine.md` |
| Q7 | Relatórios de IA ficam fora da v3.0, adiados para v3.1 com grill próprio | esta tabela (decisão de escopo, reversível, sem ADR) |
| Q8 | Catálogo `health_indicators` global, semeado na migração `007`; chave `code` interno mais `unit` canônica; analito não catalogado gera pendência | `docs/adr/0007-catalogo-semeado-com-codigo-interno-como-chave.md` |
| Q9 | Saída estruturada (`responseSchema`), esquema em Go como fonte única, lista plana, `value_text` sempre e `value_num` opcional, `prompt_version` e `schema_version` na Extração | `docs/adr/0008-saida-estruturada-com-esquema-em-go-e-versoes-gravadas.md` |
| Q10 | Observações nascem em Revisão; o dono do documento (ou `ADMIN`) confere contra o PDF e confirma ou rejeita em bloco; só então valem | `docs/adr/0009-observacoes-nascem-em-revisao-confirmadas-em-bloco.md` |
| Q11 | Extrair sempre. Cobertura pelo Laudo evolutivo não bloqueia nem avisa; a colisão continua resolvida por Q3. Decidido com base em custo medido, ver seção 6 | esta tabela (decisão reversível, sem ADR) |
| Q12 | A Extração enriquece `files` com `collected_at`, `lab_name` e `report_number`, e sugere `custom_name` só se vazio; nada sobrescreve campo humano, e só grava na confirmação do bloco | `docs/adr/0010-extracao-enriquece-metadados-do-documento.md` |
| Q13 | `gemini_model` em `app_config`, escolhido na aba admin a partir de lista curta declarada em Go, com o custo por Extração ao lado; padrão `gemini-3.1-flash-lite`. `GEMINI_API_KEY` permanece em variável de ambiente | esta tabela (decisão reversível, sem ADR) |
| Q14 | Quatro fases: 1 esquema, 2 extração sem interface, 3 revisão, 4 visualização. A fase 2 é entregável sozinha, provada por endpoint e inspeção do banco | `docs/v3/plano.md` |
| Q15 | ~~Gráfico em SVG escrito à mão, sem biblioteca~~ — **revertida pela Q18**: Chart.js entra empacotado | esta tabela, revista pelo `docs/adr/0012` |
| Q16 | Um documento guarda **uma** Extração: a nova apaga as anteriores e o que elas deixaram em revisão. Mais um "zerar" explícito, que apaga tudo daquele documento | esta tabela (decisão reversível, sem ADR) |
| Q17 | Extração liberada ao **dono do documento**; `ADMIN` alcança todos. Catálogo e escolha de modelo seguem restritos a `ADMIN` | `docs/adr/0011-extracao-liberada-ao-dono-do-documento.md` |
| Q18 | Chart.js como dependência npm empacotada pelo Vite. CDN proibido: a CSP fixa `script-src 'self'` e o PWA promete offline | `docs/adr/0012-chart-js-empacotado-no-bundle-nunca-por-cdn.md` |
| Q19 | Interação do gráfico: tooltip com data, valor, unidade e Procedência, mais clique no ponto abrindo o Laudo. Zoom só quando alguma série passar de ~50 pontos; comparar dois Indicadores é escopo próprio | esta tabela (decisão reversível, sem ADR) |
| Q20 | Eixo X `linear` em milissegundos com `ticks.callback` em pt-BR, reaproveitando `lib/date.ts`. Eixo `time` exigiria `chartjs-adapter-date-fns` mais `date-fns`; eixo `category` achataria intervalos irregulares | esta tabela (decisão reversível, sem ADR) |
| Q21 | `primary` prevalece sobre `evolutive` na **leitura** da série, nunca na escrita. O índice único inclui `provenance`, então as duas linhas sempre coexistiram e a tela repetia o valor | `docs/adr/0013-primary-prevalece-na-leitura-nao-na-escrita.md` |
| Q22 | Procedência continua visível na série (coluna ou selo, mais formato do ponto no gráfico). Matar o valor repetido não é matar a rastreabilidade | esta tabela (decisão reversível, sem ADR) |
| Q23 | **Faixa de normalidade** é conceito novo, distinto da Faixa de referência do Laudo. A do Laudo continua extraída e gravada (ADR 0004 intacto), e sai da tela | `CONTEXT.md`, mais `docs/adr/0015` |
| Q24 | `users` ganha `biological_sex` (`M`/`F`) e `birth_date`. Sexo biológico, não identidade: é fisiologia que condiciona a faixa. Jejum, gravidez, tabagismo e risco cardiovascular ficam fora, por serem estado da coleta, não característica do usuário | `docs/adr/0014-perfil-guarda-sexo-biologico-e-nascimento.md` |
| Q25 | Tela de Configuração do próprio usuário (`/config`): nome, e-mail, senha, sexo biológico, nascimento. `PATCH /users/me` novo, exigindo senha atual para troca de e-mail. Tema fica no botão da navegação | `docs/adr/0014` |
| Q26 | Faixa de normalidade em tabela própria `indicator_normal_ranges`, com `sex`, `age_min`/`age_max`, `min`/`max`, `text` e `source` **obrigatório**. Nulo em `sex`/idade significa "qualquer"; nulo em `min`/`max` significa "sem banda" | `docs/adr/0015-faixa-de-normalidade-em-tabela-propria-com-fonte-obrigatoria.md` |
| Q27 | Regra única de resolução: casa a linha mais específica; se o perfil não desempatar, mostra todos os candidatos no parágrafo e **não** desenha banda, com aviso e link para `/config` | esta tabela (decisão reversível, sem ADR) |
| Q28 | O selo de alteração continua sendo do laboratório, com o rótulo dizendo a origem ("fora da faixa do laboratório"). O MedLog não assina veredito clínico próprio. **Rótulo já aplicado**; a remoção da coluna "Faixa de referência" espera a `009`, para a tela não ficar sem banda no intervalo | esta tabela, mais `CONTEXT.md` |
| Q29 | Indicador promovido depois nasce **sem** faixa; a tela diz "não cadastrada". Faixa nova entra por migração, pesquisada e com fonte. IA preenchendo faixa clínica está fora | consequência do ADR 0015 |
| Q30 | As 55 faixas vão primeiro para `docs/faixas-de-normalidade.md`, com fonte e URL por linha e divergências entre sociedades médicas marcadas, para revisão humana. Só então a migração `009` semeia | esta tabela (decisão de processo) |
| Q31 | A faixa é resolvida pela idade de **hoje**, banda retangular. Só há usuários adultos. Vira polígono em degraus quando entrar série de criança — teto declarado em comentário `ponytail:` no código | esta tabela (decisão reversível, sem ADR) |

Glossário do domínio em `CONTEXT.md`: Indicador, Observação, Laudo, Data de coleta, **Faixa de normalidade**, **Característica do usuário**, Faixa de referência, Procedência, Laudo evolutivo, Extração, Consentimento de extração, Revisão.

---

## 3. Perguntas em aberto

Nenhuma pendente de decisão. Q1 a Q31 fechadas. O que falta é **revisão de dado**, não decisão de desenho: o usuário lê `docs/faixas-de-normalidade.md` e corrige as faixas com que discordar, em particular onde as fontes divergem (vitamina D entre SBEM/SBPC-ML e Endocrine Society, limite superior do TSH, metas de LDL por risco). A migração `009` é gerada a partir do documento aprovado.

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
- Existem **16** arquivos `_test.go` (handlers, models e db) que **não rodam no CI**. Os quatro novos da v3.0 são `internal/db/migrate_test.go`, `internal/handlers/extractions_test.go`, `internal/handlers/review_test.go` e `internal/handlers/series_test.go`.
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

### Uso real e correções: **fase 2 provada com a API de verdade**

A chamada real ao Gemini foi autorizada e executada pelo usuário, com `gemini-3.7-flash`, sobre o laudo de referência. **A prova pendente da fase 2 deixou de ser pendência.** O mapeamento fechou, e os três defeitos abaixo saíram desse uso — nenhum deles teria aparecido contra provedor falso.

**Defeito encontrado no primeiro uso real (2026-08-23), já corrigido:** com `gemini-3.7-flash`, o laudo voltou sem nenhuma faixa de referência — nem no hemograma, onde ela é impressa em coluna à direita, nem na tabela evolutiva, que tem coluna própria. O mapeamento não tinha culpa: repassa `referenceText` intacto. A causa é a documentada pelo provedor — campo ausente de `required` pode ser omitido pelo modelo para poupar tokens. Correções, todas em `prompt`/`schema` versão `2`: todo campo da observação passou a `required`, nulidade migrou de `anyOf` para `"nullable": true`, o prompt ganhou regra explícita sobre a coluna de referência (vale linha a linha, e na tabela evolutiva vale para todas as colunas de coleta) e sobre preencher `refMin`/`refMax` em intervalo único. Além disso, `deriveRange` em `internal/handlers/extractions.go` lê os limites do texto literal quando o modelo os deixa nulos, recusando faixa condicional. Na interface, o selo "faixa não informada" virou "sem marcador": ele sempre falou do marcador `(1)` do laboratório, nunca da faixa, e a redação confundia.

**Segundo defeito do uso real, também corrigido:** extrações se acumulavam. Reextrair o mesmo documento deixava as Observações da tentativa anterior paradas em revisão — as que a nova resposta não repetiu —, então o documento continuava marcado como "aguardando revisão" mesmo depois de confirmar o bloco novo, e a lista mostrava "2 extrações". Agora **um documento guarda uma extração**: ao terminar, a nova apaga as anteriores daquele documento e o que elas tinham deixado em revisão. Observação já confirmada sobrevive, porque `extraction_id` é `ON DELETE SET NULL`. Somado a isso, `DELETE /api/files/{id}/extractions` (link **zerar** na lista de documentos) apaga extrações e Observações daquele documento, confirmadas inclusive, para recomeçar do zero com outro modelo. Dois testes com mutação conferida: `TestReview_NewExtractionSupersedesLeftoverReview` e `TestReview_ResetFileStartsFromScratch`.

**Fato do desenho que apareceu ao escrever o teste, vale saber:** a chave única de Observação é `(user_id, indicator_id, collected_at, provenance)` e **ignora o documento**. Dois PDFs que cubram a mesma coleta do mesmo indicador compartilham uma linha só, e a extração mais recente vence. É o que ADR 0003 quis, mas surpreende quem espera uma linha por documento.

**Terceiro defeito do uso real, corrigido:** o laudo imprime o marcador de alteração colado ao número — `9.000(1)` — e o modelo devolveu esses resultados sem `valueNum`. Quatro das seis coletas de leucócitos caíram na lista de "não numéricos" em vez do gráfico. Junto veio um erro pior, este nosso: `deriveRange` lia `3.650` como três vírgula seiscentos e cinquenta, porque tratava o ponto como decimal. A faixa de referência de leucócitos apareceu como 3,65–8,12, mil vezes menor, e arrastou o eixo do gráfico para valores negativos. Agora `parseNumberBR` segue a convenção brasileira — ponto agrupa milhar, vírgula abre decimal —, `deriveValue` recupera o número descartando o marcador, e o marcador passou a responder `out_of_range` quando o modelo o deixa nulo. Prompt na versão `3` explica o marcador ao modelo. Verificado na tela com a série real de leucócitos: seis pontos no gráfico, faixa 3.650–8.120 desenhada, quatro pontos vermelhos, nenhuma seção de "não numéricos".

**Mudança de permissão pedida pelo usuário (ADR 0011):** a extração deixou de ser exclusiva de `ADMIN`. Qualquer usuário extrai, revisa e confirma os próprios documentos; o `ADMIN` alcança os de todos. Documento ou extração alheia responde **404**, nunca 403. Seguem restritos a `ADMIN`: promover analito ao catálogo (é global) e escolher o modelo (é configuração de servidor). O ADR 0005 ficou marcado como parcialmente superado — PII sem redação e consentimento por documento continuam valendo. Teste novo `TestExtraction_UserExtractsOwnDocument`, com mutação conferida, e verificação com usuária comum na aplicação real: sem link de Admin, com botão de extrair no próprio PDF, 404 no documento do outro e 403 na configuração de modelo.

Cada decisão nova deve, na mesma sessão: atualizar `CONTEXT.md` se criar ou alterar um termo, gerar ADR em `docs/adr/` se for difícil de reverter, e atualizar este arquivo. Commit sempre em `main`, branch único.

---

## 8. Como retomar numa sessão nova

**Onde o trabalho está:** branch `main`, último commit desta sessão. A sessão anterior (grill Q18–Q31, ADRs `0012`–`0015`, migração `008`, `/config`, Chart.js) foi commitada em `c6d8bad`.

### 8.1 O que a sessão anterior (2026-08-26, primeira) fez

Grill de 14 perguntas fechado (Q18–Q31 na seção 2), quatro ADRs novos, e a implementação de tudo que **não** depende de revisão humana de dado clínico. **Nada foi olhado no navegador** — o que a seção 8.2 então cobrou, e cumpriu.

**Verificado, não presumido — os quatro comandos passaram no fim da sessão:**

```
go build ./...            # limpo
go vet ./...              # limpo
go test ./...             # ok: internal/db, internal/handlers, internal/models
cd frontend && npm run build   # limpo (só o aviso pré-existente de StarRating)
```

**Não verificado:** nenhuma tela foi aberta no navegador. Gráfico novo, tela de Configuração e aviso de perfil incompleto compilam e passam o build, mas **ninguém olhou**. É o primeiro item da retomada.

**Arquivos novos:**

| Arquivo | Conteúdo |
|---|---|
| `docs/adr/0012…0015` | Chart.js empacotado; primary prevalece na leitura; perfil com sexo biológico; faixa em tabela própria |
| `internal/migrations/008_normal_ranges.sql` | `users.biological_sex`, `users.birth_date`, tabela `indicator_normal_ranges` **vazia** |
| `internal/models/health_test.go` | `TestObservationFindSeries_PrimaryPrevailsOverEvolutive`, guarda do ADR 0013 |
| `frontend/src/routes/Config.svelte` | tela `/config`: nome, e-mail, senha, sexo biológico, nascimento |
| `docs/faixas/*.md` | **as seis tabelas de faixas pesquisadas** — o insumo da revisão humana |

**Arquivos alterados:** `CONTEXT.md` (termos Faixa de normalidade, Característica do usuário, Faixa de referência reescrita), `docs/adr/0003` (emendado pelo 0013), `internal/models/health.go` (dedup na leitura, `LEFT JOIN files` para `source_filename`), `internal/models/user.go`, `internal/handlers/users.go` (`MeUpdate`), `internal/handlers/auth.go` (`Me` e `SignIn` devolvem o `User` completo), `cmd/medlog/main.go` (`PATCH /users/me`), `internal/db/migrate_test.go` (`DownTo(6)`), e no frontend `package.json` (chart.js 4.5.1), `api.ts`, `App.svelte`, `Navigation.svelte`, `HealthSeries.svelte`.

### 8.2 A verificação visual: **feita**, e achou dois defeitos

A lista de seis itens da sessão anterior foi conferida com a aplicação de verdade em `:3399`, num banco novo semeado com série de glicose (incluindo uma coleta com `primary` **e** `evolutive` na mesma data, para provar a dedup) e de HDL. Resultado item por item:

1. **`/indicators` desenha em Chart.js** — confirmado por `canvas` presente, `svg.chart` ausente e pixels pintados. Tooltip traz data, valor, **unidade** e procedência.
2. **Clique no ponto abre o Laudo** — confirmado interceptando `window.open`: `/api/files/{sourceFilename}` com `_blank` e `noopener`. O cursor vira `pointer` só quando a Observação tem Laudo de origem.
3. **A duplicata sumiu** — a coleta de 12/06/2025 aparece uma vez, com valor `primary` (108), e a linha `evolutive` (110) fica de fora. Confirmado na tela e na resposta da API.
4. **Aviso de perfil incompleto** — aparece no topo e leva a `/config`; desaparece quando sexo e nascimento existem.
5. **`/config` salva** — depois de corrigir dois defeitos (abaixo). 400 sem senha, 401 com senha errada, 409 com e-mail repetido, 200 quando o e-mail não muda.
6. **Tema claro e escuro** — ambos legíveis, verificados por captura de tela. O teto anotado continua: trocar de tema sem recriar o gráfico não recolore.

**Defeito 1, corrigido — era impossível salvar o perfil pela interface.** `MeUpdate` exigia a senha atual sempre que o campo `email` **estava presente** no corpo, em vez de quando o e-mail **mudava**. O formulário de Configurações manda o e-mail em toda gravação, então salvar só sexo e nascimento devolvia 400 "senha atual é obrigatória para trocar o e-mail". A correção lê `email` junto com `password_hash` e compara. O `curl` da sessão anterior não pegou isso porque omitia `email`.

**Defeito 2, corrigido — a data de nascimento voltava e o campo aparecia vazio.** `birth_date` é coluna `DATE`, e o driver a devolve como `time.Time`, que serializa `1980-05-15T00:00:00Z`. Um `<input type="date">` **recusa** esse valor e fica em branco, então reabrir `/config` mostrava o nascimento vazio e uma nova gravação o apagaria. Os três `SELECT` de `internal/models/user.go` passaram a usar `date(birth_date)`, que devolve TEXT `AAAA-MM-DD`.

**Cobertura:** `internal/handlers/users_me_test.go`, três testes, com mutação conferida nos dois defeitos — reverter a comparação de e-mail e remover o `date()` faz o teste falhar com a mensagem exata do defeito original.

**Armadilha de ambiente, não defeito:** o service worker do `vite-plugin-pwa` serve o bundle antigo com teimosia. Bundle novo só aparece depois de `unregister()` + `caches.delete()` + recarregar com query nova. Antes disso a tela mostrava o SVG da geração anterior, o que se parece muito com "o Chart.js não entrou". E `go:embed` assa o `dist` na compilação: `npm run build` sem `go build` depois não muda nada.

**Armadilha de verificação:** `MouseEvent` sintético tem `offsetX/offsetY` em zero, e o Chart.js calcula a posição por esse campo — todo clique simulado acerta a origem e nunca um ponto. Hit-test de gráfico exige mouse real (CDP). Além disso, aba em segundo plano não roda `requestAnimationFrame`, e o canvas fica **em branco** mesmo com o gráfico criado.

### 8.3 O que espera decisão do usuário

**Revisar `docs/faixas/*.md`.** Seis tabelas, uma por painel, com fonte e URL em cada linha. É dado clínico: nada disso vai ao banco antes de aprovação. Pontos que exigem escolha humana, todos já marcados nos arquivos:

- **Vitamina D**: SBEM/SBPC-ML (20 ng/mL população geral, 30 para grupos de risco) contra Endocrine Society 2011 (30 ng/mL). As três linhas estão registradas, nenhuma escolhida.
- **TSH**: limite superior divergente entre Manual Fleury (4,5 a 10,4 mUI/L conforme idade) e estudos brasileiros (~3,5 e ~4,6). Lacuna declarada entre 18 e 19 anos.
- **LDL e não-HDL**: `min`/`max` deliberadamente **vazios** — a diretriz SBC 2025 define meta por risco cardiovascular, que é estratificação médica. Os cinco números estão no texto.
- **CEA e CA 19-9**: sem faixa de normalidade, por decisão fundamentada. Só limite de ensaio, rotulado como tal. CA 19-9 divergente entre 35 e 37 U/mL.
- **Cinco percentuais do leucograma** (`neutrophils_pct` e irmãos): sem faixa citável — o Fleury publica só o absoluto. Ficam sem banda.
- **HOMA-IR**: sem consenso citável, `min`/`max` vazios.
- **RDW**: consolidado numa linha (11,8–14,2%); a fonte publica 0,1 de diferença entre sexos. Diz se prefere duas linhas.
- **Mayo Clinic Laboratories** bloqueou acesso automatizado (HTTP 403) em vários exames; os valores vieram de PDF público do próprio Mayo, espelho e Wayback. Confirmação humana recomendada antes de semear.

### 8.4 Faixa de normalidade: **código pronto, dado pendente**

A resolução e a exibição foram implementadas nesta sessão. Elas não dependiam da revisão clínica: o que depende dela é o **dado**, e só ele.

**Implementado e verificado:**

- `internal/models/normalrange.go` — `NormalRangeResolve(ctx, db, code, sex, birthDate)`. Filtra em Go, não em SQL: são poucas linhas por Indicador, e a regra de especificidade fica legível. Característica desconhecida **não filtra nada**, então o empate sobrevive e a banda não é desenhada (Q27). Idade em anos completos hoje (Q31), com `ponytail:` marcando o teto de série de criança.
- `internal/handlers/series.go` — `GET /api/health-series/{code}` agora devolve `{observations, normalRange}` numa só resposta. Contrato mudou; o único chamador (`getSeries` em `api.ts`) foi migrado junto, sem apelido nem rota velha.
- `frontend/src/routes/HealthSeries.svelte` — parágrafo "Faixa de normalidade" antes da lista de Medidas, nos três estados: resolvida (texto, a quem se aplica, fonte), ambígua (aviso, link para `/config` e **todas** as candidatas) e não cadastrada (Q29). Selo renomeado para **"fora da faixa do laboratório"** (Q28).
- `internal/models/normalrange_test.go` — cinco testes: sexo escolhe uma linha, sexo desconhecido mantém as duas, a linha mais específica vence a genérica, indicador sem faixa responde vazio em vez de erro, faixa só de texto não traz limites. Mutação conferida: trocar `len(candidates) == 1` por `>= 1` faz o teste de empate falhar.

**Verificado na tela**, com faixas de teste semeadas à mão: glicose resolvida ("70 a 99 mg/dL (jejum) — qualquer sexo, 18 anos ou mais, fonte: SBD 2024"), HDL resolvida por sexo para usuário `M`, HDL ambígua com o sexo em branco (aviso, link e as duas candidatas), e glicose "não cadastrada" depois de apagar a faixa.

**Falta, e só isso:**

1. **Migração `009`**: semeia `indicator_normal_ranges` a partir de `docs/faixas/*.md` **aprovado**. Uma linha por faixa, `source` obrigatório. Amilase e lipase saíram em duas linhas no arquivo de pesquisa (uma para `min`, outra para `max`) e devem virar uma só no SQL.
2. **Trocar a fonte da banda do gráfico** e **remover a coluna "Faixa de referência"** da lista de Medidas. Deixado deliberadamente para a mesma mudança da `009`: hoje a banda vem de `pickReferenceBand()`, que lê `refMin`/`refMax` do Laudo, e trocar a fonte antes de existir dado deixaria o gráfico **sem banda nenhuma** — regressão numa tela em uso real. Quando a `009` semear, a troca é dentro de `pickReferenceBand()` e mais nada.

### 8.5 Pendências herdadas, ainda válidas

**Teste da imagem no UNRAID** (`ghcr.io/edalcin/medlog:latest`), que não aconteceu na sessão anterior: extrair, revisar, confirmar, ver a série, zerar e reextrair.

**Oferta em aberto, não pedida:** reprocessar a resposta bruta já paga, sem nova chamada à API. `raw_response` e `gemini.ParseRaw` já existem; falta endpoint e botão.

**Depois:** v3.1, relatórios de saúde por IA, com grill próprio. Fronteira registrada em Q7: nada que se leia como diagnóstico médico.

**Higiene de segurança pendente do lado do usuário:** a `GEMINI_API_KEY` real apareceu na saída de um comando em sessão anterior (`docker compose config`). Nunca entrou no git, mas convém rotacioná-la no Google AI Studio.

### Armadilhas que já custaram tempo, para não repetir

- `ALTER TABLE ... DROP COLUMN` falha se a coluna estiver indexada: no `Down` da `007`, o índice é dropado antes. SQLite embutido é 3.49.2, folgado para `DROP COLUMN` (3.35+).
- `responseSchema` e `responseMimeType` precisam ir em camelCase; em snake_case a API ignora **em silêncio** e devolve texto livre.
- O marcador `(1)` vem **colado** no número: `9.000(1)`. `deriveValue` o descarta para achar o valor, e ele responde `out_of_range` quando o modelo deixa o campo nulo. Sem isso, o resultado cai como "não numérico" e some do gráfico.
- Número de laudo brasileiro: **ponto agrupa milhar, vírgula abre decimal** (`parseNumberBR`). Ler ao contrário deslocou a faixa de leucócitos por um fator de mil e jogou o eixo do gráfico para negativo.
- Rota de extração é escopada por dono, com 404 para o de fora. Ao acrescentar rota nova nesse conjunto, passe por `mayReachExtraction` ou `mayReachFile`: esquecer é vazamento silencioso.
- Nunca use `git checkout <arquivo>` para desfazer uma mutação de teste feita com `sed`: apaga junto todo o trabalho não commitado daquele arquivo. Use `cp` para um backup antes.
- Campo fora de `required` no `responseSchema` **é descartado pelo modelo para poupar tokens de saída** — está na documentação do provedor. Foi assim que a faixa de referência sumiu num laudo real, com `gemini-3.7-flash`: o layout imprime a faixa em coluna à direita, e o modelo tratou o campo opcional como dispensável. Desde o prompt/schema `2`, **todo** campo da observação é obrigatório; o que pode faltar vai como `null`.
- Nulidade no `responseSchema` vai como `"nullable": true`, convenção do provedor. `anyOf` misturado com irmãos e `"type": ["number","null"]` dão 400 ou comportamento silenciosamente errado.
- Faixa impressa não vira automaticamente `ref_min`/`ref_max`: `deriveRange` lê o intervalo do texto literal e **recusa** qualquer coisa condicional (sexo, idade, jejum, etnia, risco) ou aberta. É transcrição, não cálculo — ADR 0004 continua valendo.
- Tokens de raciocínio são cobrados como saída e vêm em `thoughtsTokenCount`, separado de `candidatesTokenCount`. Somar os dois, ou o custo aparece menor do que é.
- A resposta bruta é gravada **antes** de interpretar, inclusive quando a chamada falha. Corrigir parsing nunca deve custar uma nova chamada: use `gemini.ParseRaw`.
- Extração `pending` encontrada no arranque é chamada perdida, não progresso: `ExtractionMarkStale` a marca como falha.
- O PDF pode não renderizar no `<iframe>` se o navegador estiver configurado para baixar PDFs. Não é defeito do servidor; a tela oferece abrir em outra aba.
- Teste que faz rollback de migração deve usar `goose.DownTo(db, ".", N)`, nunca `goose.Down`: `Down` desfaz só o topo da pilha, então a migração nova quebra o teste da anterior. Mordeu na `008`.
- O catálogo de Indicadores é **semeado** pela `007`: teste que precisa de um Indicador deve **ler** `health_indicators` por `code`, nunca chamar `IndicatorCreate` — colide com o `UNIQUE` do seed.
- `Observation.sourceFileId` é UUID e **não** monta a URL de download: a rota é `/api/files/{filename}`, e `filename` é `{id}.{ext}` com extensão variável. Por isso `observationSelectSQL` tem `LEFT JOIN files` e devolve `source_filename`.
- `<canvas role="img">` é erro de acessibilidade no Svelte 5 (`a11y_no_interactive_element_to_noninteractive_role`). `aria-label` sozinho basta.
- A CSP em `internal/middleware/security.go` fixa `script-src 'self'`: **nenhuma** biblioteca por CDN funciona neste projeto, e o `vite-plugin-pwa` ainda promete offline. Dependência de frontend entra por npm e sai empacotada pelo Vite (ADR 0012).
- O bundle passou de ~790 kB para 989 kB minificado (326 kB gzip) com o Chart.js. É JavaScript estático dentro de uma imagem de ~30 MB, não Node em runtime — a regra do docker enxuto continua respeitada.
- Coluna declarada `DATE` ou `DATETIME` volta do driver como `time.Time`, e escanear isso num `*string` produz RFC3339 (`1980-05-15T00:00:00Z`). Um `<input type="date">` **recusa** esse valor em silêncio e fica vazio. Quando o contrato da API é data pura, use `date(coluna)` no `SELECT`: sem tipo declarado, o driver devolve TEXT.
- Guarda de credencial deve comparar **valor novo contra valor gravado**, nunca "o campo veio no corpo". O formulário manda todos os campos sempre; exigir senha por presença de `email` travou o salvamento inteiro do perfil. Teste com `curl` que omite o campo não pega esse defeito — só o formulário de verdade pega.
- O service worker do `vite-plugin-pwa` serve o bundle antigo com teimosia: bundle novo aparece só depois de `unregister()`, `caches.delete()` e recarga com query nova. E `go:embed` assa `internal/embed/dist` na compilação — `npm run build` sem `go build` depois não muda nada no binário.
- `MouseEvent` sintético tem `offsetX/offsetY` em zero, e o Chart.js hit-testa por esse campo: clique simulado por `dispatchEvent` **sempre** acerta a origem, nunca um ponto. Verificação de gráfico exige mouse real (CDP `page.mouse`).
- Aba em segundo plano não roda `requestAnimationFrame`: o Chart.js cria a instância, dimensiona o canvas e **não pinta**. Canvas em branco não prova gráfico quebrado — prova aba escondida.
