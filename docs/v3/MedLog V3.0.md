## MedLog V3.0

Quero criar uma nova versão desta ferramenta com um acréscimo importante: agregar funcionalidades baseadas na interpretação de documentos, inicialmente resultados de exames de sangue, para alimentar novas tabelas relacionadas a indicadores de saúde, no SQLite já existente.

Em essência, vou selecionar documentos (PDFs) já enviados para o MedLog e um agente de inteligência artificial, irá extrair dados destes PDFs e alimentar a base de dados de indicadores de saúde. Inicialmente vamos trabalhar com PDFs com resultados de exames de sangue. Para planejamento e testes, você pode usar o pdf @docs/pdfSangue/f39defb0-78a7-46fd-8d1c-96fea29bf841.pdf

Quero passar como variável ambiental no docker uma chave de API do Gemini (GEMINI_API_KEY), que irá permitir a seleção do modelo, via interface administrativa do MedLog, que será usado na interpretação e extração de dados dos PDFs. Vou apresentar um PDF de cada vez, dos PDFs que já estão registrados no MedLog, para carga dos indicadores de saúde (sangue) no banco de dados.

Quero que o o banco de dados, com estas novas tabelas voltadas para os indicadores de saúde, esteja preparada para receber outros indicadores além dos ofertados por exames de sangue. Estas novas tabelas também servirão de fonte de dados para o agente de AI também analisar e produzir relatórios sobre a saúde do usuário do MedLog.

Neste momento não quero implementar nada nem mudar nenhuma linha de código. Quero apenas usar a /skill:grill-with-docs para criar toda documentação necessária para esta nova versão, para ir implementando em fases, conforme a disponibilidade de créditos/tokens. Faça todo o planejamento da implementação em fases, e salve em uma documentação relacionada com esta versão 3.0, para futuros ajustes e implementação.

