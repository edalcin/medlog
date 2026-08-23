---
status: accepted
---

# Catálogo de Indicadores semeado, com código interno como chave

Laudos de laboratórios diferentes nomeiam o mesmo analito de formas diferentes: `Glicose`, `Glicemia de jejum`, `Glucose, soro`. Sem chave estável, a série temporal de um mesmo Indicador fragmenta em linhas distintas.

O catálogo `health_indicators` é semeado pela migração `007` com os cerca de 40 analitos do laudo de referência. A chave de deduplicação é `code`, um identificador interno estável (`glucose_serum`), acompanhado de `unit` canônica. O catálogo é global, não por usuário.

A Extração recebe a lista fechada de códigos e escolhe entre eles. Analito que não corresponde a nenhum código não cria Indicador: a Observação fica pendente de decisão humana, que promove um código novo ao catálogo ou descarta o achado.

## Considered Options

Nome livre, com o Indicador nascendo do texto do laudo, foi rejeitado: é exatamente o que fragmenta a série, e o dano só aparece meses depois, quando já existe histórico sujo.

LOINC como chave foi rejeitado nesta fase. São cerca de 100 mil termos, exigem download externo e atenção a licença, e o modelo erra o código quando julga apenas pelo nome impresso. LOINC entra depois como coluna opcional `loinc_code`, se exportar dado para fora do MedLog virar requisito.

## Consequences

Escolher entre códigos existentes é problema de classificação, não de invenção — é o que o modelo faz bem, e o erro é verificável contra uma lista.

O catálogo cresce por decisão humana. Um laudo de laboratório novo, com analito ainda não catalogado, gera pendência em vez de dado silenciosamente errado.

Sendo global, o catálogo é compartilhado por toda a família, coerente com o compartilhamento existente. Promover um código serve a todos os usuários, e é ação de `ADMIN`.

`unit` canônica no catálogo obriga a comparar com a unidade impressa no laudo. Divergência de unidade é pendência, nunca conversão automática silenciosa.
