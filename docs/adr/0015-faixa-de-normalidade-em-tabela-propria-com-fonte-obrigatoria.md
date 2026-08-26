---
status: accepted
---

# Faixa de normalidade em tabela própria, com fonte obrigatória

A Faixa de normalidade condiciona por gênero e idade, e cada Indicador condiciona
de um jeito: hemoglobina difere entre homem e mulher, PSA sobe por década,
glicose de jejum é igual para todos, morfologia de série vermelha não tem faixa
numérica. Guardamos em tabela própria, `indicator_normal_ranges`, com uma ou mais
linhas por Indicador: `sex` e `age_min`/`age_max` nulos significam "qualquer",
`min`/`max` nulos significam "sem banda no gráfico", `text` é o parágrafo exibido
e `source` é a fonte pesquisada. A leitura casa as Características do usuário e
escolhe a linha mais específica.

`source` é obrigatório: faixa clínica sem fonte citada não entra na base. Onde a
pesquisa não encontra consenso — CEA, CA 19-9, relação PSA livre/total — a linha
entra só com `text`, `min` e `max` nulos, e a tela diz que não há faixa
estabelecida em vez de inventar uma.

## Considered Options

Colunas em `health_indicators` (uma faixa por Indicador, sem condicionar) foi
rejeitado: o MedLog registra uma pessoa e sua família, então homem e mulher
lendo a mesma hemoglobina veriam a mesma banda e uma das duas estaria errada.

Coluna JSON com um vetor de regras resolvido em Go foi rejeitado: troca um seed
revisável em SQL por lógica em código, e SQLite não indexa nada disso.

## Consequences

Ajustar uma faixa é migração nova, não edição de formulário — o que é desejável
para dado clínico de referência: fica versionado e revisável em diff.
