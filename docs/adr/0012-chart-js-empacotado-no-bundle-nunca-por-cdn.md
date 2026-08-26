---
status: accepted
---

# Chart.js empacotado no bundle, nunca por CDN

A série temporal de Indicadores era desenhada em SVG escrito à mão, sem
biblioteca, para manter a imagem pequena. Tooltip posicionado, eixo de tempo com
escala irregular e realce de ponto passaram a ser exigidos, e escrevê-los à mão
custa mais código de manutenção do que a dependência. Adotamos Chart.js como
dependência do frontend, empacotada pelo Vite no `dist` que já vai embutido no
binário.

CDN foi rejeitado por dois motivos independentes: a Content-Security-Policy fixa
`script-src 'self'` (`internal/middleware/security.go`), e o `vite-plugin-pwa`
promete funcionamento offline. Script de terceiro seria bloqueado pelo navegador
e, se não fosse, quebraria o uso sem rede.

## Considered Options

uPlot foi considerado: ~16 KB gzip contra ~70 KB do Chart.js, e é feito para
série temporal. Rejeitado porque tooltip e legenda voltariam a ser fiação
manual, que é exatamente o custo que motivou a mudança.

Manter o SVG à mão foi rejeitado: resolve tooltip e nada além dele.

## Consequences

A regra do projeto sobre tamanho de imagem continua valendo; ela protege contra
Node em runtime e imagem gorda, não contra 70 KB de JavaScript estático — 0,2%
de uma imagem de 30 MB. Dependência de gráfico entra no bundle, jamais de uma
origem externa.
