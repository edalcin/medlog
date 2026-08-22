---
status: accepted
---

# Sem entidade Coleta: o Laudo agrupa as Observações

Um laudo produz cerca de 40 Observações que compartilham data de coleta, laboratório e médico solicitante, o que sugere uma entidade de evento. Decidimos não criar essa entidade: cada Observação carrega `collected_at` e `source_file_id`, e o agrupamento "todas as Observações deste laudo" sai do arquivo de origem, que já existe em `files` e já está ligado a consulta e profissional por `files.consultation_id` e `files.professional_id`.

## Considered Options

Uma entidade `Coleta` (data, laboratório, médico solicitante, arquivo de origem) foi rejeitada. O MedLog não tem entidade Exame: um exame é registrado hoje como `Consultation` com `Files` anexados e categorizados. Introduzir `Coleta` criaria uma terceira estrutura afirmando "aqui houve um exame", ao lado de `Consultation` e `File`, e obrigaria a decidir qual delas é a autoridade.

## Consequences

A data de coleta se repete em cada Observação do laudo. A denormalização é deliberada: torna a Observação autocontida e simplifica a consulta de série temporal. Uma Observação registrada à mão (peso, pressão arterial) tem `source_file_id` nulo, sem qualquer tratamento especial.

Das três datas presentes no laudo — coleta, liberação por analito e impressão — apenas a de coleta é armazenada em `collected_at`, por ser a que ordena a série temporal.
