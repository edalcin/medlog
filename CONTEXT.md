# MedLog

Registro pessoal de saúde auto-hospedado: consultas, profissionais, documentos e indicadores de saúde de uma pessoa e de sua família.

## Language

### Indicadores de saúde

**Indicador**:
A definição daquilo que pode ser medido, como "Glicose, soro" ou "Pressão arterial sistólica". Existe independentemente de haver qualquer medição. Identificado por `code`, interno e estável (`glucose_serum`), com `unit` canônica. Vive em catálogo global, semeado por migração e ampliado só por decisão de `ADMIN`. No código: `health_indicators`.
_Avoid_: Analito (restrito a exames laboratoriais), métrica, parâmetro, exame

**Observação**:
Uma medição concreta de um Indicador, com valor, unidade e data de coleta, como "105 mg/dL em 08/05/2026". O valor é guardado fiel em `value_text`, sempre, e em `value_num` apenas quando é número sem qualificador: `>90` fica só como texto. No código: `health_observations`.
_Avoid_: Resultado, medição, valor, indicador

**Laudo**:
O Documento emitido por um laboratório que contém Observações. É o agrupador de origem de um conjunto de Observações coletadas na mesma data: não existe entidade própria para o evento de coleta, o Laudo cumpre esse papel.
_Avoid_: Coleta, exame, relatório, boletim

**Data de coleta**:
A data em que a amostra foi retirada, comum a todas as Observações de um Laudo. É a data que ordena a série temporal. Distinta da data de liberação (por analito) e da data de impressão do Laudo. Fica também em `files.collected_at`, preenchida pela Extração, para situar o documento no tempo; a Observação mantém a sua, porque o Laudo evolutivo produz Observações de outras datas a partir do mesmo documento.
_Avoid_: Data do exame, data do laudo

**Faixa de referência**:
O intervalo esperado para uma Observação, tal como impresso no Laudo. Guardada como texto fiel (`reference_text`), sempre; com limites numéricos (`ref_min`, `ref_max`) apenas quando o Laudo apresenta faixa única e inequívoca; e com `out_of_range` lido do marcador de alteração do próprio laboratório. O MedLog não calcula faixa nem decide se um resultado está alterado.
_Avoid_: Valor de referência, valor normal, intervalo normal

**Procedência**:
De qual parte do Laudo a Observação foi extraída. `primary` designa o bloco principal, com método, unidade e faixa de referência; `evolutive` designa a tabela comparativa de coletas anteriores, que traz apenas valor e data. Na colisão, `primary` prevalece.
_Avoid_: Origem, fonte, tipo

**Laudo evolutivo**:
A tabela comparativa ao final do Laudo, com os resultados de coletas anteriores identificados por data. Fonte das Observações de Procedência `evolutive`.
_Avoid_: Histórico, tabela comparativa

**Extração**:
O envio de um Laudo ao modelo de IA e a interpretação da resposta em Observações. É registro persistido em `extractions`, criado antes da chamada e portador de estado, da resposta bruta do modelo, de quem disparou, quando, qual modelo e o custo em tokens. Restrita a `ADMIN`.
_Avoid_: Processamento, análise, importação, parsing

**Consentimento de extração**:
A aceitação explícita, dada por documento, de que aquele Laudo seja enviado ao provedor de IA sem redação da PII. Sem Consentimento não há Extração.
_Avoid_: Autorização, permissão, opt-in

**Revisão**:
O estado em que a Observação nasce, antes de valer. Observação em Revisão não aparece em gráfico nem em série temporal. Um `ADMIN` confere a lista inteira da Extração contra o Laudo e confirma ou rejeita em bloco.
_Avoid_: Aprovação, validação, rascunho, staging
