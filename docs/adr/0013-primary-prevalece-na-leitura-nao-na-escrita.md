---
status: accepted
---

# Primary prevalece na leitura, não na escrita

O ADR 0003 declarou que, na colisão entre Procedências para a mesma data, a
Observação `primary` sobrescreve a `evolutive`. O esquema nunca cumpriu isso: o
índice único é `(user_id, indicator_id, collected_at, provenance)`, e o
`ON CONFLICT` grava por essa chave, então as duas linhas coexistem e a série
temporal mostrava o mesmo valor duas vezes, com fontes diferentes.

Corrigimos na leitura, não na escrita. A consulta de série escolhe, para cada
Data de coleta, a Observação `primary` quando ela existe, e a `evolutive`
somente quando não existe nenhuma `primary` daquela data. A escrita continua
gravando ambas.

## Considered Options

Apagar as `evolutive` ao gravar uma `primary` foi rejeitado: a tabela
comparativa é a única testemunha independente do valor quando a Extração lê o
número errado, e apagá-la destrói o sinal que denuncia o erro.

Remover `provenance` do índice único foi rejeitado: faria a última Extração
gravada vencer, de modo que processar um laudo evolutivo depois sobrescreveria
um valor primário por um de metadados pobres.

## Consequences

A tabela guarda deliberadamente linhas que a interface nunca mostra. Removido o
Laudo primário de uma data, a Observação `evolutive` daquela data reaparece
sozinha — a preferência é derivada em tempo de consulta, não gravada.
