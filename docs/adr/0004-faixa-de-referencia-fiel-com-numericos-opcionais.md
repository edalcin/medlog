---
status: accepted
---

# Faixa de referência fiel, com limites numéricos opcionais

As faixas de referência do laudo são condicionais, e cada analito condiciona por um eixo diferente: TSH por idade, ácido úrico por sexo, triglicérides por jejum, LDL por categoria de risco cardiovascular, eGFR por etnia e equação, hemograma por sexo e idade. O laudo de referência traz várias faixas alternativas impressas para o mesmo analito.

Cada Observação armazena a Faixa de referência em três campos: `reference_text`, cópia fiel do texto impresso no laudo, sempre preenchido; `ref_min` e `ref_max`, limites numéricos opcionais, preenchidos apenas quando o laudo apresenta uma faixa única e inequívoca para aquele resultado; e `out_of_range`, booleano lido do marcador `(1)` que o próprio laboratório imprime ao lado do resultado alterado.

O MedLog nunca calcula nem escolhe faixa. Quando o laudo é ambíguo, `ref_min` e `ref_max` ficam nulos e só o texto permanece.

## Considered Options

Armazenar apenas o texto fiel foi rejeitado: nenhum gráfico consegue desenhar a faixa nem sinalizar alteração sem interpretar texto livre em tempo de consulta.

Armazenar apenas `ref_min`/`ref_max` foi rejeitado: força a extração a escolher uma faixa entre várias condicionais, sem conhecer sexo, idade e condição de jejum com a confiabilidade que o laboratório já tem. Produziria valores errados justamente nos analitos mais condicionais.

## Consequences

`ref_min` e `ref_max` são esparsos por desenho. Todo consumidor precisa tratar nulo, e o gráfico desenha a faixa apenas onde ela existe.

O alerta de resultado alterado depende do marcador do laboratório, não de comparação própria. Laudo de outro laboratório sem marcador equivalente deixa `out_of_range` nulo, que significa "não informado", nunca "dentro da faixa".

Observações de Procedência `evolutive` normalmente não trazem faixa própria: a tabela comparativa imprime a referência em coluna única, aplicável ao resultado corrente.
