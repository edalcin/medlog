# Necessidades de correções:

* > A lista de profissionais (http://192.168.1.10:3123/professionals) deve mostrar todos, por default. Quero uma tabela filtrável e indexável

* Uma vez selecionada a clínica no registro de novos profissionais, preencher automaticamente o endereço e o telefone, vindos da clínica

* > No painel administrativo de profissionais, substituir CRM por Clinica

* > Na edição dos detalhes da consulta não está aparecendo edição dos arquivos associados.

* > Não há necessidade de um card para data, profissional e especialidades nos detalhes da consulta. Só listar na mesma fonte que o "propósito da consulta" e "Observações"

* > Garanta que no Docker os arquivos uploadeados estejam indo para o lugar certo, definido nas variáveis do Docker
  >

* > No cadastro e edição de consultas, quero um segundo botão na seção de "Documentos e Imagens", para "Associar arquivos". Este botão permitirá associar "n" arquivos que já foram enviados para o sistema, pelo nome que foram cadastrados.

* > Quero adicionar registro de "Eventos", Tipo "Febre" e "Teste positivo para COVID". O registro de evento usará a mesma ficha do registro de consultas, que passará a ser chamado de "Consultas e Eventos" em todo o sistema. Na ficha de registro de Consultas terá um "radio button" para dizer se é "consulta" ou "evento" que será registrado. No registro de eventos não há "Profissional de Saúde" associado, assim, se selecionado "evento", desabilitar a seleção de profissional de saúde na ficha de cadastro. Apenas "Data da Consulta ou Evento", "Propósito da Consulta ou Título do Evento", "Observações" e "Documentos e Imagens". Em resumo, o registro de eventos é exatamente igual ao registro de consultas, apenas será marcado como "Evento", na seleção do radiobutton, e não terá profissional de saúde associado. A lista de "Consultas" (https://medlog.dalc.in/consultations) passa a ser de "Consultas e Eventos". "Propósito" na ficha de consulta passa a ser "Propósito ou Evento", para poder associar um título ao evento. "Data da Consulta" passa a ser "Data da Consulta ou Evento". O Dashboard deve contar separadamente Consultas e Eventos. Esta grande modificação deve ser commitada para um novo branch. Irei testar localmente antes de merge com o main branch.

* Usuários:

  * Profissionais, Consultas e Eventos e Clinicas são associados aos users

  * Categorias e Especialidades são comuns a todos os usuários

* Não dá mensagem quando arquivo é maior que o permitido

* Separar Consulta e Evento no Dashboard

* Relatório de Consultas:

  * pulldown de profissional mostra o nome e "-". Deve mostrar o "nome - especialidade"

  
  
  
  
    Consultas Afetadas:
  
    1. Consulta: 11/07/2023 - Dra. Maria Fernanda B. Bueno da Silveira (Cardiologista)
  
      - URL: https://medlog.dalc.in/consultations/d958593f-e8d8-4572-b177-efb6e2d38e42
      - Arquivos faltando:
          - 20230712_atestado_cardiologista.pdf
        - 20230706_laudo_teste_ergometrico.pdf
    2. Consulta: 06/07/2023 - Dra. Suzan Tabasnik (Otorrinolaringologista)
  
      - URL: https://medlog.dalc.in/consultations/c1f87340-bbdc-4739-9f6b-b91b041e4473
      - Arquivo faltando:
          - 20230707_receita_otorrino.pdf
    3. Consulta: 03/12/2024 - Dra. Juliana Quintanilha G. Avilés (Dermatologista)
  
      - URL: https://medlog.dalc.in/consultations/91208dea-42e4-49b2-a15f-c27472d091ae
      - Arquivo faltando:
          - 20241204encaminhajulianadermato.pdf
    4. Consulta: 03/07/2024 - Dr. Rodrigo Kaz (Ortopedista)
  
      - URL: https://medlog.dalc.in/consultations/24931529-15d9-473e-b041-07d1d9d613f5
      - Arquivo faltando:
          - 20240618_ressonancia_joelho.pdf ← Este é o que você mencionou!
  
  
