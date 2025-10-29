<div align="center">
  <img src="public/doctor-icon.png" alt="MedLog Logo" width="120" height="120">
  <h1>MedLog - Sistema de Registro de Consultas Médicas</h1>
  <p><em>Sistema completo para gerenciamento de histórico médico pessoal e familiar</em></p>
</div>

[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://github.com/edalcin/medlog/pkgs/container/medlog)
[![GHCR Image](https://img.shields.io/badge/ghcr.io-edalcin%2Fmedlog-1f425f?logo=github)](https://github.com/users/edalcin/packages/container/package/medlog)
[![GitHub Container Registry](https://img.shields.io/badge/container%20registry-ghcr.io-blue.svg)](https://github.com/edalcin/medlog/pkgs/container/medlog)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/next.js-14+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-MVP%20Ready-green.svg)](https://github.com/edalcin/medlog)

---

## 📋 Visão Geral

O MedLog é um sistema web self-hosted para centralizar todo o histórico médico de consultas, exames, laudos, receitas e procedimentos em um único local seguro e organizado.

Projetado especialmente para uso familiar, o sistema permite registrar consultas médicas em texto livre (com suporte a Markdown), fazer upload de PDFs e imagens de exames e resultados, além de gerenciar profissionais de saúde com suas especialidades.

### ✅ Principais Funcionalidades

- Registro de consultas médicas com notas em Markdown
- Upload de documentos (PDF, PNG, JPG até 10MB)
- **Geração automática de thumbnails** para imagens e PDFs
- Gestão de profissionais de saúde com múltiplas especialidades
- Categorização de arquivos (Laudos, Receitas, Pedidos de Exame, etc.)
- Associação de profissionais a clínicas/hospitais
- **Painel administrativo avançado:**
  - Histórico completo de logins de usuários
  - Gerenciamento de arquivos com modal de detalhes
  - Visualização de informações completas do arquivo
  - Geração de thumbnails sob demanda
- Relatórios e análises do histórico médico
- Controle de acesso por usuário (uso familiar)
- Interface responsiva e moderna

---

## 🐳 Instalação no Unraid

⚠️ **Para instruções detalhadas de instalação no Unraid, veja [UNRAID_SETUP.md](UNRAID_SETUP.md)**

### Resumo Rápido

1. **Pré-requisitos:**
   - MariaDB 11+ já rodando com database e usuário criados
   - Docker instalado no Unraid

2. **Configuração:**
   - Gerar `NEXTAUTH_SECRET`: `openssl rand -base64 32`
   - Criar arquivo `unraid-setup.sh` no servidor Unraid (veja modelo em UNRAID_SETUP.md)
   - Executar: `bash unraid-setup.sh`

3. **Primeiro acesso:**
   ```bash
   docker exec -it medlog npm run seed:admin
   ```

**Note:** O arquivo `unraid-setup.sh` contém dados sensíveis e não deve ser versionado. Mantenha-o apenas localmente no servidor.

---

## 📖 Documentação Adicional

- **[Guia de Setup no Unraid](UNRAID_SETUP.md)** - Instruções detalhadas para instalar no Unraid com variáveis de ambiente
- **[Documentação Técnica](TECHNICAL.md)** - Arquitetura, estrutura do banco de dados e desenvolvimento local
- **[Instruções para Claude](CLAUDE.md)** - Guia de desenvolvimento para IA
- **[Especificação Técnica](.specify/inicioDesenv.md)** - Detalhes completos da implementação

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🙏 Agradecimentos

- [Next.js](https://nextjs.org/) - Framework React
- [Prisma](https://www.prisma.io/) - ORM
- [NextAuth.js](https://next-auth.js.org/) - Autenticação
- [shadcn/ui](https://ui.shadcn.com/) - Componentes UI
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework

---

## 📞 Suporte

Para questões e suporte:
- **Issues:** [GitHub Issues](https://github.com/edalcin/medlog/issues)
- **Documentação Técnica:** [TECHNICAL.md](TECHNICAL.md)

---

**Desenvolvido com ❤️ para uso familiar**

**Última atualização: 29 de outubro de 2025**
