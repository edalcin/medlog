# MedLog

Registro pessoal de saúde auto-hospedado: consultas, profissionais, documentos e indicadores de saúde de uma pessoa e de sua família.

## Language

### Indicadores de saúde

**Indicador**:
A definição daquilo que pode ser medido, como "Glicose, soro" ou "Pressão arterial sistólica". Existe independentemente de haver qualquer medição. No código: `health_indicators`.
_Avoid_: Analito (restrito a exames laboratoriais), métrica, parâmetro, exame

**Observação**:
Uma medição concreta de um Indicador, com valor, unidade e data de coleta, como "105 mg/dL em 08/05/2026". No código: `health_observations`.
_Avoid_: Resultado, medição, valor, indicador

**Laudo**:
O Documento emitido por um laboratório que contém Observações. É o agrupador de origem de um conjunto de Observações coletadas na mesma data: não existe entidade própria para o evento de coleta, o Laudo cumpre esse papel.
_Avoid_: Coleta, exame, relatório, boletim

**Data de coleta**:
A data em que a amostra foi retirada, comum a todas as Observações de um Laudo. É a data que ordena a série temporal. Distinta da data de liberação (por analito) e da data de impressão do Laudo.
_Avoid_: Data do exame, data do laudo

**Procedência**:
De qual parte do Laudo a Observação foi extraída. `primary` designa o bloco principal, com método, unidade e faixa de referência; `evolutive` designa a tabela comparativa de coletas anteriores, que traz apenas valor e data. Na colisão, `primary` prevalece.
_Avoid_: Origem, fonte, tipo

**Laudo evolutivo**:
A tabela comparativa ao final do Laudo, com os resultados de coletas anteriores identificados por data. Fonte das Observações de Procedência `evolutive`.
_Avoid_: Histórico, tabela comparativa
