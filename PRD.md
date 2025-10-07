# MedLog - sistema de registro de consultas médicas, resultados e laudos de exames e profissionais de saúde.



## Visão Geral e Contexto

Este sistema irá permitir o registro de consultas médicas, em texto livre, bem como upload de PDFs e imagens de resultados de exames, laudos, receitas, pedidos de exames etc. O sistema irá permitir o registro de profissionais de saúde, que serão relacionados com o registro de consultas, PDFs e Imanges de resultados de exames, laudos, receitas, pedidos de exames etc.

Este sistema irá ser instalado como um app (docker) no Unraid, e receberá variáveis de ambiente para definicão de conexão com banco de dados, onde ficarão os registros médicos, e path onde ficarão os arquivos uploadeados.

O problema que este sistema quer resolver é a falta de um local centralizado onde todo seu histórico médico de consultas, exames, procedimentos etc possa ser consultado.

## Público-Alvo e Escopo

* O sistema será usado por um grupo muito pequeno de pessoas. Apenas minha família. Terá um administrador.

## Funcionalidades

### Evento Central: Registro de Consulta Médica

**O registro da consulta médica é o evento central do sistema.** O fluxo de uso principal é:

1. **Início do Registro:**
   - O usuário informa a **data da consulta**
   - Seleciona o **profissional de saúde** em um pulldown (dropdown)
   - O pulldown lista apenas profissionais **ativos**

2. **Criação Rápida de Profissional:**
   - Se o profissional não existir na lista, o usuário pode **adicionar o nome diretamente** na interface de registro
   - Um registro básico do profissional é criado automaticamente
   - Posteriormente, os dados completos (especialidade, CRM, telefone, endereço) podem ser complementados na interface de edição do profissional

3. **Registro da Consulta em Texto Livre:**
   - Campo de texto livre (com suporte a Markdown) para notas da consulta
   - Registro de sintomas, diagnóstico, prescrições, orientações, etc.

4. **Upload de Documentos e Imagens:**
   - Durante o registro da consulta, o usuário pode anexar documentos (PDF) e imagens (PNG, JPG)
   - Os arquivos ficam **associados à consulta E ao profissional de saúde**
   - Tipos de documentos: receitas, exames, laudos, pedidos de exames, etc.

### Gestão de Profissionais de Saúde

- **Ficha Completa do Profissional:**
  - Nome (obrigatório)
  - Especialidade (obrigatório)
  - CRM (opcional)
  - Telefone(s) de contato (opcional)
  - Endereço (opcional)
  - Status: **Ativo** ou **Inativo**

- **Profissionais Ativos vs Inativos:**
  - Apenas profissionais **ativos** aparecem no pulldown do registro de consulta
  - Profissionais inativos permanecem no sistema (não são deletados) mas não ficam disponíveis para novas consultas
  - Útil para médicos que não atende mais, profissionais que mudaram de cidade, etc.

### Visualização e Relatórios

O sistema oferece múltiplas formas de visualizar informações:

#### Visualização de Documentos:
- **Por Consulta:** Ver todos os documentos de uma consulta específica
- **Por Profissional:** Ver todos os documentos relacionados a um profissional (todas as consultas)
- **Por Especialidade:** Ver todos os documentos de consultas de uma especialidade específica

#### Visualização de Consultas:
- **Por Data:** Filtrar consultas por dia, mês ou ano
- **Por Profissional:** Ver histórico completo de consultas com um profissional
- **Por Especialidade:** Ver todas as consultas de uma especialidade (ex: Ortopedia, Dermatologia)
- **Timeline:** Visualização cronológica do histórico médico

#### Relatórios:
- Relatório de consultas por profissional
- Relatório de consultas por especialidade
- Relatório de consultas por período (dia, mês, ano)
- Histórico completo de um paciente (usuário do sistema)



## Design e Experiência do Usuário (UX/UI)

* Quero uma interface moderna e limpa

## Requisitos Fuincionais, Não Funcionais e Técnicos

* O banco de dados que será utilizado é o mariaDB - os dados de conexão (IP, Porta, login e senha) serão passados via variável de ambiente no Docker para o UNRAID
* O login será feito via Google (OAuth 2.0)
* O primeiro login será do administrador, que também será um usuário do sistema
* Uma área de administração será criada, para gerenciamento dos usuários, dos arquivos PDF e de imagens, registro de profissionais e consultas
* O administrador irá cadastrar eventuais usuários, pelo seu endereço de email no GMAIL
* Os arquivos ficarão em uma pasta que será definida via variável de ambiente no app (docker) do Unraid
* Use a melhor linguagem para criar uma ferramenta moderna, atraente e com bom desempenho
* O docker (package) deve sempre ser criado no repositório ghcr.io/edalcin/ para testes e uso imediato
* Instruções para instalação no Unraid devem estar presentes no README.md



## 
