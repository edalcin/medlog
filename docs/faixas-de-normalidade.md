# Faixas de normalidade — documento de revisão

Este é o insumo da migração `009`, que vai semear `indicator_normal_ranges`
(ADR 0015). **Nada daqui está no banco.** A migração só é escrita depois que
você revisar e corrigir o que discordar.

Cada tabela tem uma linha por faixa, com `source` e URL obrigatórios. Onde não
há faixa numérica citável, `min` e `max` ficam vazios de propósito e o texto
explica por quê — nenhum número foi inventado.

| Painel | Arquivo | Indicadores |
|---|---|---|
| Hemograma | [`faixas/faixas-hemograma.md`](./faixas/faixas-hemograma.md) | 22 |
| Glicemia e insulina | [`faixas/faixas-glicemia.md`](./faixas/faixas-glicemia.md) | 5 |
| Lipídios | [`faixas/faixas-lipidios.md`](./faixas/faixas-lipidios.md) | 6 |
| Renal, eletrólitos e ácido úrico | [`faixas/faixas-renal.md`](./faixas/faixas-renal.md) | 11 |
| Hormônios e vitaminas | [`faixas/faixas-hormonios.md`](./faixas/faixas-hormonios.md) | 4 |
| PSA, marcadores tumorais e enzimas pancreáticas | [`faixas/faixas-marcadores.md`](./faixas/faixas-marcadores.md) | 7 |

## O que exige sua decisão

Cada item abaixo está marcado no arquivo correspondente. São escolhas de dado
clínico, não de desenho — por isso não foram tomadas.

1. **Vitamina D.** SBEM/SBPC-ML (20 ng/mL na população geral, 30 em grupos de
   risco) contra Endocrine Society 2011 (30 ng/mL). As três linhas estão
   registradas; escolha qual vale para você. A atualização de 2024 da Endocrine
   Society abandonou cortes numéricos, o que está anotado.
2. **TSH.** Limite superior divergente: Manual Fleury publica por faixa de idade
   (4,5 mUI/L dos 20 aos 59, subindo até 10,4 acima dos 80); estudos brasileiros
   sugerem limites mais baixos (~3,5 e ~4,6). Há lacuna declarada entre 18 e 19
   anos, não preenchida por invenção.
3. **LDL e não-HDL.** `min`/`max` vazios de propósito: a diretriz SBC 2025
   define **meta por risco cardiovascular**, que é estratificação médica. Os
   cinco valores por categoria estão no texto. Se você souber sua categoria de
   risco, diga qual — mas note que ela muda com o tempo, e a coluna não existe.
4. **CEA e CA 19-9.** Sem faixa de normalidade: são marcadores de acompanhamento,
   lidos pela tendência, não pelo valor isolado. Só o limite de ensaio foi
   registrado, rotulado como tal. CA 19-9 divergente entre 35 e 37 U/mL.
5. **Cinco percentuais do leucograma** (`neutrophils_pct` e irmãos). Sem faixa
   citável: o Fleury publica apenas o valor absoluto para adultos, por decisão
   documentada do laboratório. Ficam sem banda no gráfico.
6. **HOMA-IR.** Sem consenso citável. O valor mais repetido (BRAMS, >2,71) é
   corte de pesquisa epidemiológica, e o ELSA-Brasil achou outro (2,35).
7. **RDW.** Consolidado numa linha (11,8–14,2%). A fonte publica 0,1 de
   diferença entre sexos — diga se prefere duas linhas com os valores exatos.
8. **Mayo Clinic Laboratories** bloqueou acesso automatizado (HTTP 403) em vários
   exames. Os valores vieram de PDF público do próprio Mayo, de espelho e do
   Wayback Machine, com as URLs originais preservadas. Confirmação humana
   recomendada antes de semear.

## Ajuste mecânico pendente

Amilase e lipase saíram em duas linhas cada no arquivo de pesquisa (uma para
`min`, outra para `max`), por causa de como a tabela foi redigida. Na migração
viram uma linha só por Indicador.
