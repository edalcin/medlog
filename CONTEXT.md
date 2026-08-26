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

**Faixa de normalidade**:
Os valores de um Indicador considerados normais para as características do usuário — gênero, idade e o que mais aquele Indicador condicionar. Vem de pesquisa em fonte confiável, guardada junto ao Indicador, e nunca do Laudo. É o que a tela mostra: parágrafo antes da lista de Medidas e banda no gráfico.
_Avoid_: Faixa ideal, faixa esperada, valor normal, intervalo normal

**Característica do usuário**:
O que do usuário condiciona uma Faixa de normalidade: sexo biológico e data de nascimento, de onde sai a idade. Fisiologia, nunca identidade — a faixa de hemoglobina responde a eritropoiese e volume sanguíneo, e o PSA só se aplica a quem tem próstata. Fato estável da pessoa, editado por ela na tela de Configuração. Estado de uma coleta — jejum, gravidez, tabagismo, risco cardiovascular — não é Característica, porque valeria retroativamente para todo o histórico.
_Avoid_: Gênero, perfil, dados demográficos, condição

**Faixa de referência**:
O intervalo que o laboratório imprimiu no Laudo ao lado daquele resultado, com as condições que ele mesmo aplicou. Guardada fiel (`reference_text`), com limites numéricos (`ref_min`, `ref_max`) só quando o Laudo apresenta faixa única e inequívoca, e com `out_of_range` lido do marcador de alteração do próprio laboratório. Guardada, não exibida: quem julga a normalidade na tela é a Faixa de normalidade. O MedLog não calcula esta faixa nem decide se um resultado está alterado.
_Avoid_: Faixa do laudo, valor de referência

**Procedência**:
De qual parte do Laudo a Observação foi extraída. `primary` designa o bloco principal, com método, unidade e faixa de referência; `evolutive` designa a tabela comparativa de coletas anteriores, que traz apenas valor e data. Havendo as duas para a mesma Data de coleta, a série mostra a `primary`; a `evolutive` fica guardada e só aparece onde não há `primary`.
_Avoid_: Origem, fonte, tipo

**Laudo evolutivo**:
A tabela comparativa ao final do Laudo, com os resultados de coletas anteriores identificados por data. Fonte das Observações de Procedência `evolutive`.
_Avoid_: Histórico, tabela comparativa

**Extração**:
O envio de um Laudo ao modelo de IA e a interpretação da resposta em Observações. É registro persistido em `extractions`, criado antes da chamada e portador de estado, da resposta bruta do modelo, de quem disparou, quando, qual modelo e o custo em tokens. Cada usuário extrai os próprios documentos; o `ADMIN` alcança os de todos (ADR 0011). Um documento guarda uma Extração: a nova substitui a anterior.
_Avoid_: Processamento, análise, importação, parsing

**Consentimento de extração**:
A aceitação explícita, dada por documento, de que aquele Laudo seja enviado ao provedor de IA sem redação da PII. Sem Consentimento não há Extração.
_Avoid_: Autorização, permissão, opt-in

**Revisão**:
O estado em que a Observação nasce, antes de valer. Observação em Revisão não aparece em gráfico nem em série temporal. O dono do documento — ou um `ADMIN` — confere a lista inteira da Extração contra o Laudo e confirma ou rejeita em bloco.
_Avoid_: Aprovação, validação, rascunho, staging
