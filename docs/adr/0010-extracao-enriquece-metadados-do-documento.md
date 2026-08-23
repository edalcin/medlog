---
status: accepted
---

# A Extração enriquece os metadados do documento

`files` não tem hoje nenhum campo que descreva o conteúdo do laudo: guarda `filename`, `custom_name`, `path`, `mime_type`, `size`, `hash`, `thumbnail_path`, os vínculos e `uploaded_at`. Nada situa o documento no tempo em que o exame foi feito.

A Extração passa a enriquecer o documento. `files` recebe `collected_at`, `lab_name` e `report_number`, o número de ficha do laudo. Quando `custom_name` está vazio, a Extração sugere um, no formato "Exame de sangue — 08/05/2026".

O enriquecimento obedece à regra de Q10: o metadado sugerido só é gravado quando o `ADMIN` confirma o bloco de Revisão. Campo já preenchido por humano nunca é sobrescrito — a divergência é mostrada, e a decisão é dele.

## Considered Options

Gravar apenas `collected_at` foi rejeitado: `lab_name` e `report_number` chegam na mesma resposta, sem custo adicional em tokens, e são o que identifica o laudo sem abrir o PDF.

Vincular automaticamente o médico solicitante a `professionals`, criando o profissional quando não existe, foi rejeitado. `professionals` é tabela curada à mão; nome lido por IA produziria duplicata com grafia divergente, e desfazer isso é trabalho manual maior do que criar o vínculo. O médico extraído aparece na Revisão, e vincular é ação humana de um clique.

## Consequences

`collected_at` em `files` é o campo que situa o documento no tempo, e não substitui o `collected_at` da Observação: são o mesmo valor por construção, mas a Observação continua autônoma, porque o Laudo evolutivo produz Observações de outras datas a partir do mesmo documento.

Documento nunca extraído fica com os três campos nulos. Toda consulta que os use precisa tolerar isso, e a interface não pode apresentá-los como obrigatórios.

`report_number` é PII: identifica a ficha do paciente no laboratório. Vive sob o mesmo `ON DELETE CASCADE` por `user_id` do resto.

A sugestão de `custom_name` é o primeiro caso no projeto em que a Extração escreve em campo que o usuário também edita. A regra de não sobrescrever é o que mantém isso previsível.
