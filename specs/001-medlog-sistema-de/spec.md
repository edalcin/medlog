# Feature Specification: MedLog - Sistema de Registro de Consultas Médicas

**Feature Branch**: `001-medlog-sistema-de`  
**Created**: 7 de outubro de 2025  
**Status**: Draft  
**Input**: User description from PRD.md

## Clarifications

### Session 2025-10-07

- Q: Quais são os requisitos específicos de segurança e privacidade para o tratamento de dados médicos neste sistema? → A: Segurança mínima familiar (apenas autenticação, sem criptografia especial)
- Q: Quais são os volumes esperados de dados para consultas e arquivos por usuário neste sistema familiar? → A: cerca de 20 a 25 consultas por ano, por usuário, por vários anos
- Q: Como os profissionais de saúde são identificados de forma única para prevenir duplicatas? → A: Apenas por nome (permite duplicatas com mesmo nome)
- Q: Quais requisitos de conformidade se aplicam ao armazenamento de dados médicos neste sistema? → A: Nenhum específico (proteção geral de dados)
- Q: Quais são as expectativas de confiabilidade e disponibilidade para o sistema? → A: Disponibilidade básica (sistema funciona quando acessado, sem garantias de uptime)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar Consulta Médica (Priority: P1)

Como usuário, quero registrar uma consulta médica informando data, selecionando profissional de saúde, adicionando notas em texto livre e anexando documentos/imagens, para manter um histórico centralizado do meu atendimento médico.

**Why this priority**: Esta é a funcionalidade central do sistema, permitindo o registro básico de consultas que é o evento principal descrito no PRD.

**Independent Test**: Pode ser testado independentemente criando uma consulta com dados básicos e verificando se ela aparece na listagem de consultas.

**Acceptance Scenarios**:

1. **Given** usuário está logado no sistema, **When** acessa a tela de registro de consulta e preenche data, seleciona profissional ativo da lista, adiciona notas e anexa um PDF, **Then** a consulta é salva com sucesso e aparece na timeline do usuário
2. **Given** profissional desejado não existe na lista, **When** usuário digita o nome diretamente no campo de seleção, **Then** um registro básico do profissional é criado automaticamente e associado à consulta
3. **Given** consulta registrada com anexos, **When** usuário visualiza a consulta, **Then** todos os documentos e imagens associados são exibidos

---

### User Story 2 - Gerenciar Profissionais de Saúde (Priority: P2)

Como usuário, quero gerenciar os profissionais de saúde cadastrados, incluindo adicionar novos, editar informações completas e marcar como ativo/inativo, para manter uma base atualizada de profissionais que atendo.

**Why this priority**: Essencial para suportar o registro de consultas, pois os profissionais são selecionados durante o cadastro de consultas.

**Independent Test**: Pode ser testado independentemente criando, editando e desativando profissionais, verificando se apenas ativos aparecem na seleção de consultas.

**Acceptance Scenarios**:

1. **Given** usuário acessa gestão de profissionais, **When** adiciona um novo profissional com nome e especialidade obrigatórios, **Then** o profissional é criado como ativo e aparece na lista de seleção
2. **Given** profissional cadastrado, **When** usuário edita informações adicionais como CRM, telefone e endereço, **Then** as alterações são salvas e refletidas em consultas futuras
3. **Given** profissional não atende mais, **When** usuário marca como inativo, **Then** o profissional não aparece mais na lista de seleção para novas consultas mas permanece associado a consultas existentes

---

### User Story 3 - Visualizar e Filtrar Histórico Médico (Priority: P3)

Como usuário, quero visualizar meu histórico médico de diferentes formas (por data, profissional, especialidade) e acessar documentos associados, para consultar facilmente meu passado médico.

**Why this priority**: Complementa o registro permitindo acesso e análise do histórico acumulado.

**Independent Test**: Pode ser testado independentemente visualizando consultas existentes e aplicando filtros, verificando se os resultados correspondem aos critérios.

**Acceptance Scenarios**:

1. **Given** usuário tem consultas registradas, **When** filtra por data específica, **Then** apenas consultas daquela data são exibidas
2. **Given** usuário seleciona um profissional, **When** visualiza histórico, **Then** todas as consultas com aquele profissional são listadas cronologicamente
3. **Given** usuário filtra por especialidade, **When** acessa documentos, **Then** todos os anexos de consultas daquela especialidade são agrupados

---

### User Story 4 - Administração do Sistema (Priority: P2)

Como administrador, quero gerenciar usuários do sistema, profissionais e arquivos, para manter o controle e organização do sistema familiar.

**Why this priority**: Necessário para operação do sistema em ambiente familiar com múltiplos usuários.

**Independent Test**: Pode ser testado independentemente cadastrando usuários por email e verificando acesso ao sistema.

**Acceptance Scenarios**:

1. **Given** administrador logado, **When** cadastra novo usuário por email Gmail, **Then** o usuário recebe convite e pode fazer primeiro login via Google OAuth
2. **Given** arquivos enviados, **When** administrador acessa área de administração, **Then** pode visualizar, organizar e gerenciar todos os PDFs e imagens do sistema

### Edge Cases

- O que acontece quando o upload de arquivo falha devido a tamanho excessivo ou tipo não suportado?
- Como o sistema lida quando múltiplos usuários tentam editar o mesmo profissional simultaneamente?
- O que ocorre se o banco de dados MariaDB fica indisponível durante o registro de consulta?
- Como o sistema comporta quando um profissional é desativado mas tem consultas associadas?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema DEVE permitir registro de consultas médicas com data, profissional, notas em texto livre com suporte a Markdown e anexos de PDF/imagens
- **FR-002**: Sistema DEVE listar apenas profissionais ativos no dropdown de seleção durante registro de consulta
- **FR-003**: Sistema DEVE criar registro básico de profissional automaticamente quando nome é digitado diretamente na interface de registro
- **FR-004**: Sistema DEVE permitir edição completa de dados do profissional (nome, especialidade, CRM, telefone, endereço, status ativo/inativo)
- **FR-005**: Sistema DEVE associar arquivos enviados tanto à consulta quanto ao profissional de saúde
- **FR-006**: Sistema DEVE suportar visualização de consultas filtradas por data (dia, mês, ano), profissional ou especialidade
- **FR-007**: Sistema DEVE fornecer timeline cronológica do histórico médico do usuário
- **FR-008**: Sistema DEVE permitir geração de relatórios de consultas por profissional, especialidade e período
- **FR-009**: Sistema DEVE implementar autenticação via Google OAuth 2.0
- **FR-010**: Sistema DEVE ter área administrativa para gerenciamento de usuários, arquivos e registros
- **FR-011**: Sistema DEVE permitir cadastro de usuários adicionais pelo administrador via email Gmail
- **FR-012**: Sistema DEVE armazenar arquivos em pasta configurável via variável de ambiente
- **FR-013**: Sistema DEVE conectar ao banco MariaDB usando credenciais passadas via variáveis de ambiente
- **FR-014**: Sistema DEVE ser empacotado como container Docker para instalação no Unraid

### Non-Functional Requirements

- **NFR-001**: Sistema DEVE implementar segurança mínima familiar com autenticação via Google OAuth, sem requisitos especiais de criptografia para dados médicos
- **NFR-002**: Sistema DEVE suportar aproximadamente 20-25 consultas por ano por usuário, acumulado por vários anos
- **NFR-003**: Sistema DEVE seguir proteção geral de dados sem requisitos específicos de conformidade para dados médicos
- **NFR-004**: Sistema DEVE ter disponibilidade básica sem garantias específicas de uptime

### Key Entities *(include if feature involves data)*

- **Consulta**: Representa um atendimento médico, com atributos data, profissional associado, notas em texto livre, lista de arquivos anexados
- **Profissional**: Representa profissional de saúde, com nome obrigatório, especialidade obrigatória, CRM opcional, telefones opcionais, endereço opcional, status ativo/inativo; identificação única por nome (duplicatas permitidas)
- **Usuário**: Representa usuário do sistema, autenticado via Google OAuth, pode ser administrador ou usuário comum
- **Arquivo**: Representa documento ou imagem anexada, associada a consulta e profissional, armazenada em sistema de arquivos

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem registrar uma consulta completa (com anexos) em menos de 5 minutos
- **SC-002**: Sistema suporta até 10 usuários simultâneos sem degradação de performance
- **SC-003**: 95% das buscas por consultas retornam resultados em menos de 2 segundos
- **SC-004**: Usuários localizam documentos específicos em menos de 1 minuto usando filtros
- **SC-005**: Taxa de conclusão bem-sucedida do registro de consulta é superior a 98%
- **SC-006**: Interface é considerada moderna e limpa por pelo menos 90% dos usuários em testes de usabilidade
