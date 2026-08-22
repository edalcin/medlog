---
status: accepted
---

# Ingestão do laudo evolutivo, distinguida por procedência

Os laudos laboratoriais trazem, além do resultado corrente, uma tabela evolutiva com os resultados de coletas anteriores — no laudo de referência, seis coletas cobrindo de 2018 a 2025. Decidimos ingerir também esses valores, porque entregam anos de série temporal a partir do primeiro laudo processado, em vez de exigir acúmulo de coletas futuras.

Cada Observação carrega `provenance`: `primary` quando extraída do bloco principal do laudo, com método, unidade e faixa de referência completos; `evolutive` quando extraída da tabela comparativa, que traz apenas valor e data. Na colisão entre as duas, `primary` sobrescreve `evolutive`, nunca o contrário.

## Considered Options

Ignorar a tabela evolutiva foi rejeitado: descarta histórico que já está disponível. Armazenar o histórico em tabela separada também foi rejeitado — paga o mesmo preço em qualidade de metadados e ainda quebra a consulta de série temporal, que passaria a exigir `UNION`.

## Consequences

Parte das Observações nasce com metadados incompletos: sem método, sem unidade própria (a unidade aparece apenas na coluna de referência da tabela) e sem data de liberação. A interface precisa expor a procedência, para que um ponto de gráfico vindo da tabela comparativa não se apresente como equivalente a um resultado primário.

A colisão é garantida e esperada: ao processar o laudo de uma coleta anterior, seus valores chegam como `primary` e devem substituir os `evolutive` já gravados para a mesma data.
