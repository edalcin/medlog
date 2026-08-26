---
status: accepted
---

# O perfil guarda sexo biológico e nascimento, nunca o estado da coleta

A Faixa de normalidade depende das Características do usuário, então o perfil
precisa carregá-las. Guardamos duas: **sexo biológico** (`biological_sex`, `M` ou
`F`) e **data de nascimento**. A idade sai derivada da data, de modo que a faixa
envelhece com o usuário sem ninguém reeditar nada. As duas ficam em `users`,
editáveis pelo próprio usuário na tela de Configuração, junto com nome, e-mail e
senha.

O campo é sexo biológico, não identidade de gênero, porque é fisiologia que
condiciona a faixa: hemoglobina, hematócrito, eritrócitos, creatinina e ácido
úrico diferem por massa muscular, volume sanguíneo e eritropoiese, e PSA só se
aplica a quem tem próstata. A tela diz por que pergunta — "usado apenas para
determinar a faixa de normalidade dos exames" — em vez de parecer cadastro
burocrático.

Gravidez, jejum, tabagismo e categoria de risco cardiovascular ficam de fora,
por não serem características do usuário: são estados de uma coleta, num dia
específico. Guardá-los no perfil os faria valer retroativamente para todo o
histórico, o que é falso. Risco cardiovascular é ainda mais grave: é
estratificação clínica feita por médico, não campo de formulário.

Etnia também fica de fora, mas por outro motivo: o catálogo já a resolve no
próprio Indicador (`egfr_ckd_epi_2009_black` e `egfr_ckd_epi_2009_non_black` são
Indicadores distintos), então o laudo escolhe a variante e o perfil não precisa
opinar.

## Consequences

Onde a Faixa de normalidade depende de jejum, gravidez ou risco, ela permanece
condicional em texto e o gráfico não desenha banda — mostra o parágrafo e nada
mais. Escolher uma banda nesses Indicadores seria o MedLog emitindo parecer
clínico, que é exatamente o que ele não faz.

Gênero e data de nascimento são PII. Ficam no SQLite auto-hospedado e não vão ao
provedor de IA: a Extração envia o Laudo, nunca o perfil.

Trocar o próprio e-mail é trocar a própria credencial de login
(`users.email UNIQUE`), por isso exige confirmação da senha atual, como a troca
de senha já exige.
