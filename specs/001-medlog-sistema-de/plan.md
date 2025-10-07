# Implementation Plan: MedLog - Sistema de Registro de Consultas Médicas

**Branch**: `001-medlog-sistema-de` | **Date**: 7 de outubro de 2025 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-medlog-sistema-de/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: Node.js 20+ with TypeScript  
**Primary Dependencies**: Next.js 14 (React framework), Prisma (ORM), Tailwind CSS (styling)  
**Storage**: MariaDB  
**Testing**: Jest + React Testing Library (frontend), Vitest (backend)  
**Target Platform**: Docker container for Unraid  
**Project Type**: Web application (full-stack Next.js)  
**Performance Goals**: Register consultation <5 min, search results <2 sec, support 10 concurrent users  
**Constraints**: Basic availability, general data protection, no specific compliance  
**Scale/Scope**: Small family (10 users max), ~500 consultations total, few GB files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is template - no specific constraints defined. Assuming compliance with general best practices.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/                          # Next.js app directory
├── api/                      # API routes
│   ├── auth/                 # Authentication routes
│   ├── consultations/        # Consultation CRUD
│   ├── professionals/        # Professional management
│   └── admin/                # Admin routes
├── components/               # React components
│   ├── ui/                   # Reusable UI components
│   ├── forms/                # Form components
│   └── layout/               # Layout components
├── lib/                      # Utility libraries
│   ├── prisma/               # Database client
│   ├── auth/                 # Authentication utilities
│   └── validation/           # Validation schemas
├── models/                   # Data models/types
├── styles/                   # Global styles
└── utils/                    # Helper functions

public/                       # Static assets
├── uploads/                  # File uploads (symlink to FILES_PATH)

prisma/                       # Database schema
└── schema.prisma

tests/                        # Test files
├── __tests__/                # Unit/integration tests
└── e2e/                      # End-to-end tests

docker/                       # Docker configuration
├── Dockerfile
└── docker-compose.yml
```

**Structure Decision**: Full-stack Next.js application with app directory structure, separated API routes, component organization, and Docker setup for Unraid deployment.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
