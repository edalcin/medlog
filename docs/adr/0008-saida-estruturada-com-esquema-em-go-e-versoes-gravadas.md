---
status: accepted
---

# Saída estruturada, esquema declarado em Go, versões gravadas na Extração

O laudo de referência traz resultados que não são números: `>90`, `normais`, `----` e texto morfológico livre. E a resposta bruta da Extração fica persistida, então trocar o interpretador não deve exigir pagar a chamada de novo.

A Extração usa a saída estruturada do Gemini (`responseSchema`). O esquema é declarado em Go, fonte única, e produz uma lista plana de Observações — o hemograma não vira estrutura aninhada, cada sub-analito é uma Observação com seu próprio Indicador.

O valor tem dois campos: `value_text`, cópia fiel do que está impresso, sempre preenchido; e `value_num`, opcional, preenchido só quando o resultado é um número sem qualificador. `>90` grava `value_text = ">90"` e `value_num` nulo.

Cada Extração grava `prompt_version` e `schema_version`.

## Considered Options

Pedir JSON no prompt e fazer parsing livre foi rejeitado: erro de formato é o modo de falha mais caro aqui, porque só se manifesta depois de gastar tokens.

Function calling foi rejeitado: resolve o mesmo problema com mais partes móveis, e não há ferramenta para o modelo chamar.

Um único campo de valor, numérico, foi rejeitado pelo mesmo motivo já aceito para a Faixa de referência: forçaria inventar `90` onde o laudo diz `>90`.

## Consequences

`value_num` é esparso por desenho. Gráfico e cálculo ignoram Observação sem valor numérico; a interface ainda a mostra, porque `normais` e o texto morfológico são informação clínica real.

As versões gravadas tornam a resposta bruta reinterpretável. Corrigir o interpretador e reprocessar o que já está no banco é operação local, sem custo em tokens.

O esquema em Go é a fonte única: mudança nele é mudança de contrato e obriga incrementar `schema_version`.

Lista plana significa que a relação entre um analito e seus sub-analitos, como no hemograma, não é expressa pelo contrato de saída. Se essa hierarquia precisar aparecer na interface, ela vem do catálogo de Indicadores, nunca da resposta do modelo.
