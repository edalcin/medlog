---
status: accepted
supersedes: 0005 (apenas a restrição a ADMIN)
---

# Extração liberada ao dono do documento

Qualquer `USER` autenticado dispara a extração nos **próprios** documentos. O `ADMIN` continua alcançando os documentos de todos, como no resto do painel.

Cada rota com escopo de extração confere o dono e responde **404** a quem não é: `POST /extractions`, `GET /extractions/{id}`, `/review`, `/observations`, `/confirm`, `/reject`, `GET` e `DELETE /files/{id}/extractions`. A revisão em bloco passa a ser ato do dono do documento, não mais exclusivo do `ADMIN`.

Duas coisas seguem restritas a `ADMIN`: **promover analito ao catálogo**, porque `health_indicators` é global e uma decisão de um usuário mudaria o vocabulário de todos (ADR 0007), e **escolher o modelo**, porque é configuração de servidor com custo associado (Q13).

## Considered Options

O ADR 0005 restringiu a extração a `ADMIN` "nesta primeira fase", com um motivo declarado: a `GEMINI_API_KEY` é credencial global do servidor, o gasto recai sobre quem paga a chave, e num uso familiar um `USER` gastaria o dinheiro do `ADMIN`. Esse motivo continua verdadeiro; o que mudou é o peso dele.

O uso real mostrou o custo do outro lado: com a extração restrita, o `ADMIN` vira gargalo do laudo alheio, e a revisão — que exige conferir valor a valor contra o PDF — cai sobre quem não é o paciente. Conferir o próprio exame é justamente o trabalho que o dono faz melhor, e o consentimento por documento perde sentido quando quem consente não é quem envia.

Cota por usuário foi novamente rejeitada, pelo mesmo motivo do ADR 0005: desenho prematuro. O custo medido é de cerca de US$ 0,02 a US$ 0,13 por laudo (seção 6 de `docs/proximosPassos.md`), o volume é familiar, e cada extração já grava `triggered_by`, modelo e tokens. Se o gasto doer, o dado para desenhar a cota já está gravado.

Restringir ao dono **e** exigir aprovação final do `ADMIN` foi rejeitado: dobra o número de passos, mantém o gargalo e não protege nada que o registro de autoria já não cubra.

## Consequences

O consentimento por documento continua obrigatório e agora é dado por quem de fato é dono do dado — que é o que o ADR 0005 queria desde o começo.

A resposta a documento alheio é 404, nunca 403: a existência da extração de outra pessoa já é informação. Isso vale inclusive para o `USER` que tenta adivinhar um id.

O gasto passa a poder ser disparado por qualquer usuário da instância. Quem opera o servidor controla isso pela chave: sem `GEMINI_API_KEY` no ambiente, ninguém extrai. Não há cota; há registro.

`ADMIN` continua enxergando tudo, então o suporte familiar — extrair e revisar o laudo de quem não quer fazê-lo — permanece possível.
