---
status: accepted
---

# Observações nascem em revisão, confirmadas em bloco

A Extração produz dado que alimenta gráfico de saúde. O modelo erra, e o erro perigoso não é o que ele marca como incerto: é o analito que ele mapeia com confiança para o Indicador errado.

As Observações de uma Extração nascem em **Revisão**. Um `ADMIN` confere a lista inteira contra o PDF, lado a lado, e confirma ou rejeita em bloco. Só depois da confirmação as Observações valem: aparecem em gráfico, em série temporal e em qualquer consulta de indicador.

## Considered Options

Gravação direta, com correção posterior item por item, foi rejeitada: o dado errado já esteve no gráfico, e ninguém audita o que parece plausível.

Revisar apenas as pendências foi rejeitado. Parece econômico, mas cobre exatamente o erro que o modelo já sinalizou, e deixa passar o mapeamento confiante e errado, que é o caso grave.

## Consequences

Nenhuma Observação chega ao gráfico sem um humano ter olhado o laudo. É o contrapeso de Q5, em que o `ADMIN` dispara extrações de documentos da família.

A confirmação é em bloco: o custo por laudo é um ato, não quarenta. A interface precisa mostrar a lista inteira ao lado do PDF, com a Faixa de referência e o marcador de alteração visíveis, porque é o que permite reconhecer mapeamento errado sem reler o laudo linha por linha.

Estado de Revisão é estado de dado, não de Extração: uma Extração concluída com sucesso ainda tem Observações que não valem.

Rejeitar em bloco não apaga a resposta bruta. A Extração rejeitada continua auditável e reinterpretável.
