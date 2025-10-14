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

  
