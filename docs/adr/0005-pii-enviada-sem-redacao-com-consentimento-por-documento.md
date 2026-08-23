---
status: accepted
---

# PII enviada sem redação, com consentimento por documento e extração restrita a ADMIN

A extração de indicadores por IA é a primeira vez que dado de saúde identificável sai deste servidor. O laudo carrega nome completo, data de nascimento, número de ficha, médico e CRM, e a identificação do laboratório.

O PDF é enviado ao Gemini **sem redação**. Cada envio exige **Consentimento de extração**, registrado por documento, e a extração é restrita a `ADMIN` nesta primeira fase. Todo envio registra quem disparou, quando, qual modelo e o custo em tokens.

## Considered Options

Redigir a PII antes de enviar foi rejeitado por dois motivos concretos. A validação de que o laudo pertence ao usuário certo depende do nome impresso no PDF, único elo entre o arquivo e a pessoa. E a interpretação das faixas de referência depende da idade, exigida por TSH, hemograma e eGFR. O ganho seria ilusório: o corpo do laudo é dado de saúde íntimo, com ou sem o cabeçalho. Redigir PDF de 16 páginas em Go puro, sem dependência com C, também é trabalho real contra um benefício que não se sustenta.

Consentimento único no ato de habilitar a extração foi rejeitado: cada extração é um envio novo a terceiro, e o consentimento deve acompanhar o envio, não a configuração.

Permitir que qualquer `USER` dispare extração nos próprios documentos foi rejeitado nesta fase. A `GEMINI_API_KEY` é credencial global do servidor e o gasto recai sobre quem paga a chave; com compartilhamento familiar, um `USER` gastaria o dinheiro do `ADMIN`. Cota por usuário foi rejeitada como desenho prematuro: entra quando o gasto real doer.

## Consequences

O usuário aceita explicitamente, por documento, que aquele PDF seja enviado ao Google. A interface precisa dizer isso sem eufemismo, nomeando o destinatário e o que vai nele.

`ADMIN`-only significa que, num uso familiar, o `ADMIN` extrai os laudos dos demais. O consentimento por documento é o contrapeso: sem ele, nenhum envio acontece.

O registro de quem, quando, qual modelo e quanto custou é obrigatório desde a primeira extração — é a base tanto da auditoria de privacidade quanto da decisão futura sobre cota.
