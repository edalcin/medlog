# Research & Technical Decisions

**Feature**: MedLog - Sistema de Registro de Consultas Médicas
**Date**: 7 de outubro de 2025

This document captures the research and decision-making process for technical choices in the MedLog implementation.

## Technology Stack Decisions

### Decision: Node.js 20+ with TypeScript
**Rationale**: 
- Modern JavaScript runtime with excellent performance and ecosystem
- TypeScript provides type safety, reducing runtime errors in a data-sensitive medical application
- Strong support for full-stack development with Next.js
- Good Docker support for containerization
- Active community and long-term support

**Alternatives considered**:
- Python with FastAPI: Good for APIs, but less integrated for full-stack web apps
- Go: High performance, but steeper learning curve for web UI
- PHP/Laravel: Traditional web stack, but less modern compared to Node.js ecosystem

### Decision: Next.js 14 for Full-Stack Framework
**Rationale**:
- Modern React framework with app directory for better organization
- Built-in API routes eliminate need for separate backend
- Excellent developer experience with hot reload, TypeScript support
- Good performance with automatic optimizations
- Strong ecosystem for authentication, database integration
- Easy deployment as Docker container

**Alternatives considered**:
- Traditional React + Express: More complex setup, separate concerns
- Svelte/SvelteKit: Innovative, but smaller ecosystem
- Nuxt.js (Vue): Good, but React has larger community for medical/health apps

### Decision: Prisma for Database ORM
**Rationale**:
- Type-safe database access with auto-generated types
- Excellent MariaDB support
- Schema migrations and database management
- Good integration with Next.js and TypeScript
- Active development and community

**Alternatives considered**:
- TypeORM: Good, but Prisma has better DX
- Drizzle: Newer, but less mature for MariaDB
- Raw SQL: Too low-level for this project scope

### Decision: Tailwind CSS for Styling
**Rationale**:
- Utility-first approach for modern, clean UI as specified
- Fast development without custom CSS
- Responsive design utilities
- Good integration with Next.js
- Small bundle size with purging

**Alternatives considered**:
- Styled Components: More flexible, but heavier
- CSS Modules: Good, but more boilerplate
- Bootstrap: Less modern than Tailwind

### Decision: Jest + React Testing Library for Testing
**Rationale**:
- Standard testing setup for React applications
- Good integration with Next.js
- Component testing with React Testing Library for user-centric tests
- Vitest for faster backend API testing

**Alternatives considered**:
- Cypress for E2E: Good for integration, but overkill for small app
- Testing Library only: Less framework integration

## Architecture Decisions

### Decision: Full-Stack Next.js (No Separate Backend)
**Rationale**:
- Simplifies deployment as single Docker container
- Reduces complexity for small family application
- Next.js API routes handle all backend logic
- Good for rapid development and maintenance

**Alternatives considered**:
- Separate API + Frontend: More complex deployment, overkill for scale

### Decision: File Storage via Local Filesystem
**Rationale**:
- Simple for Unraid environment
- Direct filesystem access via Docker volume mount
- No need for cloud storage complexity
- Configurable path via environment variables

**Alternatives considered**:
- Database BLOBs: Less efficient for large files
- Cloud storage (S3): Unnecessary complexity for local deployment

## Security Decisions

### Decision: Google OAuth 2.0 Only
**Rationale**:
- Simple authentication for family use
- No password management complexity
- Google handles security best practices
- Easy user management via Gmail emails

**Alternatives considered**:
- Custom auth: More complex, security risks
- Other OAuth providers: Google most common for family

### Decision: Basic Security (No Encryption at Rest)
**Rationale**:
- Family use with trusted environment
- Compliance not required as clarified
- Simplifies implementation and operations
- HTTPS via reverse proxy if needed

**Alternatives considered**:
- Full encryption: Overkill for use case, performance impact

## Performance & Scalability

### Decision: Optimize for Small Scale (10 users, 500 consultations)
**Rationale**:
- No premature optimization needed
- Next.js provides good defaults
- MariaDB sufficient for small dataset
- Focus on usability over performance at scale

**Alternatives considered**:
- Microservices: Overkill for small app
- Advanced caching: Not needed

## Deployment Decisions

### Decision: Single Docker Container
**Rationale**:
- Simple deployment on Unraid
- All dependencies bundled
- Easy updates and rollbacks
- Matches Unraid container philosophy

**Alternatives considered**:
- Multiple containers: More complex orchestration
- Bare metal: Less portable

## Summary

All technical decisions prioritize simplicity, modern development experience, and suitability for a small family medical record system. The stack provides good performance for the expected scale while being maintainable by a single developer.