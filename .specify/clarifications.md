# Questões para Clarificação - MedLog

Este documento lista as decisões e esclarecimentos necessários antes de iniciar o desenvolvimento.

---

## 1. Stack Tecnológico

### 1.1 Backend Framework
**Opções propostas:**
- **Opção A:** Node.js com Express.js (mais simples, direto)
- **Opção B:** Node.js com NestJS (mais estruturado, TypeScript nativo)
- **Opção C:** .NET Core (performance superior, tipagem forte)

**Pergunta:** Qual framework você prefere para o backend?

**Recomendação:** Node.js com Express.js para simplicidade, ou NestJS se quiser estrutura mais robusta desde o início.

---

### 1.2 Frontend Framework
**Opções propostas:**
- **Opção A:** Next.js 14 com App Router (React)
- **Opção B:** Nuxt 3 (Vue.js)

**Pergunta:** Você tem preferência entre React e Vue? Alguma experiência prévia?

**Recomendação:** Next.js 14 pela maturidade do ecossistema e facilidade de encontrar recursos.

---

### 1.3 ORM
**Opções propostas:**
- **Opção A:** Prisma (moderno, type-safe, ótimo DX)
- **Opção B:** TypeORM (mais tradicional, flexível)
- **Opção C:** Sequelize (veterano, amplamente usado)

**Pergunta:** Alguma preferência de ORM?

**Recomendação:** Prisma pela experiência de desenvolvimento superior.

---

## 2. Autenticação

### 2.1 Biblioteca de Autenticação
**Opções propostas:**
- **Opção A:** NextAuth.js (integrado ao Next.js, mais simples)
- **Opção B:** Passport.js (tradicional, mais controle)

**Pergunta:** Prefere simplicidade (NextAuth) ou controle total (Passport)?

**Recomendação:** NextAuth.js se usar Next.js, pela integração nativa.

---

### 2.2 Gestão de Sessões
**Opções:**
- **Opção A:** JWT apenas (stateless)
- **Opção B:** Sessions no banco de dados (mais controle)
- **Opção C:** Híbrido (JWT + sessions para logout)

**Pergunta:** Como prefere gerenciar sessões de usuário?

**Recomendação:** Híbrido para melhor balanço entre performance e controle.

---

## 3. Estrutura da Aplicação

### 3.1 Arquitetura do Projeto
**Opções:**
- **Opção A:** Monolito (frontend + backend no mesmo projeto/container)
- **Opção B:** Separado (frontend e backend em projetos/containers distintos)

**Pergunta:** Prefere tudo em um único container ou separado?

**Recomendação:** Monolito para simplicidade de deploy no Unraid (um único container).

---

### 3.2 TypeScript
**Pergunta:** Deseja usar TypeScript em todo o projeto ou JavaScript puro?

**Recomendação:** TypeScript para melhor manutenibilidade e menos erros.

---

## 4. Funcionalidades

### 4.1 Editor de Notas
**Opções para campo de notas das consultas:**
- **Opção A:** Textarea simples (texto puro)
- **Opção B:** Editor rico com Markdown (formatar texto)
- **Opção C:** Editor WYSIWYG completo (tipo Word)

**Pergunta:** Que tipo de editor deseja para as notas das consultas?

**Recomendação:** Editor com Markdown (meio termo - permite formatação sem complexidade).

---

### 4.2 Visualização de PDFs
**Opções:**
- **Opção A:** Download apenas (usuário abre no navegador/app)
- **Opção B:** Visualizador embutido (PDF.js)
- **Opção C:** Conversão para imagem (preview rápido)

**Pergunta:** Como os PDFs devem ser visualizados?

**Recomendação:** Visualizador embutido + opção de download.

---

### 4.3 Limites de Arquivo
**Perguntas:**
- Qual o tamanho máximo por arquivo? (sugestão: 10MB)
- Quantos arquivos por consulta? (sugestão: ilimitado, mas com alerta se > 20)
- Limite total de storage? (para avisos de espaço)

**Recomendação:** 10MB por arquivo, sem limite de quantidade, alerta ao administrador quando storage atingir 80%.

---

### 4.4 Imagens - Thumbnail
**Pergunta:** Deseja gerar thumbnails automáticos das imagens para visualização rápida?

**Recomendação:** Sim, gerar thumbnails (reduz tempo de carregamento nas listagens).

---

### 4.5 Busca
**Opções:**
- **Opção A:** Busca simples (LIKE em nome, especialidade, profissional)
- **Opção B:** Busca full-text (busca no conteúdo das notas)
- **Opção C:** Busca avançada (múltiplos filtros combinados)

**Pergunta:** Que tipo de busca deseja implementar no MVP?

**Recomendação:** Busca simples no MVP, full-text como melhoria futura.

---

## 5. Interface do Usuário

### 5.1 Tema
**Pergunta:** Deseja suporte a Dark Mode desde o início?

**Recomendação:** Não no MVP (adicionar depois), focar em um tema claro bem feito.

---

### 5.2 Responsividade
**Pergunta:** Prioridade de dispositivos:
- Desktop first?
- Mobile first?
- Ambos igualmente?

**Resposta:** Desktop first

---

### 5.3 Idioma
**Pergunta:** Sistema será apenas em Português (Brasil)?

**Recomendação:** Sim, apenas PT-BR para simplificar MVP.

---

### 5.4 Notificações
**Pergunta:** Deseja notificações no sistema? Exemplos:
- Lembrete de consultas futuras
- Novo usuário cadastrado (para admin)
- Espaço de armazenamento baixo

**Recomendação:** Não no MVP (pode adicionar depois).

---

## 6. Segurança e Privacidade

### 6.1 HTTPS
**Pergunta:** Pretende usar HTTPS? (requer certificado SSL)

**Resposta:** HTTPS via Tunel Cloudflare, e HTTP localmente para testes

---

### 6.2 Backup
**Pergunta:** Deseja rotina de backup automático integrada ou será manual?

**Recomendação:** Manual inicialmente (instruções no README), automático como melhoria futura.

---

### 6.3 Logs de Auditoria
**Pergunta:** Que ações devem ser logadas?
- Todas?
- Apenas críticas (criação/exclusão)?
- Não implementar no MVP?

**Resposta:** Não implementar

---

### 6.4 Retenção de Dados
**Pergunta:** Quando um usuário é desativado, o que acontece com seus dados?
- Mantém tudo (soft delete do usuário apenas)
- Remove consultas também
- Apenas esconde mas pode reativar

**Recomendação:** Soft delete - mantém tudo, apenas marca usuário como inativo (pode reativar).

---

## 7. Deployment

### 7.1 Versionamento de Container
**Pergunta:** Estratégia de tags no ghcr.io:

Sempre `latest`?

- Tags por versão (`v1.0.0`, `v1.1.0`)?
- Ambos (latest + versão)?

**Recomendação:** Ambos - latest para facilidade + versões específicas para estabilidade.

---

### 7.2 Migrations de Banco
**Pergunta:** Como lidar com atualizações que requerem mudanças no banco?
- Manual (README com instruções)
- Automático no startup do container
- Script separado

**Recomendação:** Automático no startup (Prisma Migrate no entrypoint).

---

### 7.3 Health Check
**Pergunta:** O health check deve verificar:
- Apenas se app responde?
- App + conexão com banco?
- App + banco + pasta de uploads acessível?

**Recomendação:** App + banco (essencial), pasta de uploads não bloqueia startup.

---

## 8. Dados de Exemplo

### 8.1 Seed Inicial
**Pergunta:** Deseja dados de exemplo (seed) para facilitar testes?
- Alguns profissionais pré-cadastrados
- Especialidades comuns
- Consultas de exemplo

**Recomendação:** Sim.

---

### 8.2 Especialidades
**Pergunta:** As especialidades serão:
- Texto livre (usuário digita)?
- Lista pré-definida (dropdown)?
- Híbrido (dropdown com opção "Outro")?

**Recomendação:** Híbrido - lista comum + possibilidade de adicionar nova.

**Lista sugerida de especialidades:**
- Cardiologia
- Dermatologia
- Endocrinologia
- Gastroenterologia
- Ginecologia/Obstetrícia
- Neurologia
- Oftalmologia
- Ortopedia
- Otorrinolaringologia
- Pediatria
- Psiquiatria
- Urologia
- Clínico Geral
- Outro

---

## 9. Performance e Limites

### 9.1 Paginação
**Pergunta:** Quantos itens por página nas listagens?
- Consultas: ?
- Profissionais: ?
- Usuários: ?
- Arquivos: ?

**Recomendação:** 
- Consultas: 20 por página
- Profissionais: 50 por página
- Usuários: 50 por página (lista pequena)
- Arquivos: todos da consulta (geralmente poucos)

---

### 9.2 Cache
**Pergunta:** Implementar cache (Redis) no MVP?

**Recomendação:** Não no MVP (adicionar se necessário depois).

---

## 10. Testes

### 10.1 Cobertura de Testes
**Pergunta:** Nível de testes desejado no MVP:
- Sem testes (entregar rápido)
- Testes unitários básicos
- Testes de integração
- Testes E2E completos

**Resposta:** Testes unitários básicos

---

## 11. Documentação

### 11.1 Documentação de API
**Pergunta:** Deseja documentação automática da API (Swagger/OpenAPI)?

**Recomendação:** Sim, usar Swagger - ajuda no desenvolvimento e manutenção futura.

---

### 11.2 Comentários no Código
**Pergunta:** Nível de comentários desejado:
- Mínimo (apenas código complexo)
- Moderado (funções principais)
- Extensivo (tudo documentado)

**Recomendação:** Moderado - JSDoc nas funções públicas, comentários em lógica complexa.

---

## 12. Decisões Rápidas Necessárias

Para iniciar o desenvolvimento imediatamente, preciso de decisões sobre:

### ⚠️ CRÍTICO (bloqueia início):
1. **Stack Backend:** Express.js, NestJS ou .NET Core?
2. **Arquitetura:** Monolito ou Separado?
3. **TypeScript:** Sim ou Não?

### 🔶 IMPORTANTE (pode decidir depois, mas melhor definir agora):
4. **Editor de Notas:** Simples, Markdown ou WYSIWYG?
5. **Visualização PDF:** Download, Embutido ou Conversão?
6. **Dark Mode:** Desde início ou depois?
7. **Especialidades:** Livre, Lista ou Híbrido?

### ✅ PODE USAR PADRÕES (não precisa decidir agora):
8. Limites de arquivo: 10MB
9. Paginação: 20 consultas, 50 profissionais
10. Thumbnails: Sim
11. Busca: Simples no MVP
12. Logs: Ações críticas
13. HTTPS: Via reverse proxy
14. Idioma: PT-BR apenas
15. Testes: Integração nos endpoints principais

---

## Próximos Passos

Após receber as respostas para as questões críticas e importantes, posso:

1. Criar a estrutura inicial do projeto
2. Configurar ambiente de desenvolvimento
3. Implementar primeiro módulo (autenticação)
4. Configurar CI/CD
5. Iniciar desenvolvimento incremental

**Tempo estimado após decisões:** 2-3 semanas para MVP completo.

---

**Documento criado em:** 2025-01-07  
**Status:** Aguardando decisões do usuário
