---
status: accepted
---

# Extração persistida antes da chamada, executada em goroutine

Dois fatos do repositório impedem o caminho síncrono óbvio. O wrapper `fetch` em `frontend/src/lib/api.ts` aborta toda request em 30 segundos, e um laudo de 16 páginas com cerca de 40 analitos não volta nesse prazo. O SQLite roda com uma única conexão física (`MaxOpenConns=1`), então manter uma transação aberta durante a chamada ao Gemini bloquearia a aplicação inteira.

A Extração é gravada em `extractions` **antes** da chamada, no estado `pending`. Uma goroutine executa a chamada ao Gemini **fora de qualquer transação**, grava a **resposta bruta** do modelo na própria linha, e só então interpreta o conteúdo em Observações. O frontend consulta o estado da Extração por *polling*.

## Considered Options

Inline síncrono com timeout maior foi rejeitado. Prende a request por minutos e não sobrevive ao navegador desistir nem ao container reiniciar — e a extração perdida já foi paga em tokens.

Fila com worker dedicado, com *retry* e *backoff*, foi rejeitada como desenho prematuro: o usuário seleciona um PDF por vez, não existe lote. Se o lote aparecer, a tabela `extractions` já é a fila e o worker se acrescenta sem redesenho.

## Consequences

A resposta bruta fica persistida. Um erro de interpretação se corrige relendo o que já está no banco, sem pagar a extração de novo, e é a evidência de auditoria do que o modelo devolveu.

A resposta bruta contém dados de saúde identificáveis e vive no banco pelo mesmo prazo do documento; o `ON DELETE CASCADE` por `user_id` a alcança.

O estado da Extração é observável e precisa cobrir a falha: uma goroutine morta por reinício do container deixa uma linha `pending` órfã, que a interface deve mostrar como falha, não como progresso.

Nenhuma transação envolve a chamada externa, então a conexão única do SQLite nunca fica presa esperando a rede.
