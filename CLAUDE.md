# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedLog is a self-hosted medical consultation tracking system designed for families to maintain private medical records. The core entity is the **Consultation** (medical appointment), which connects Users, Professionals, and Files (documents/images).

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Prisma ORM, MariaDB 11+, NextAuth.js, Tailwind CSS

## Development Commands

```bash
# Development
npm run dev                      # Start dev server on http://localhost:3000
npm install                      # Install dependencies

# Database
npx prisma db push               # Sync schema to database (development)
npx prisma generate              # Generate Prisma Client
npm run prisma:migrate:dev       # Create and apply migrations (development)
npm run prisma:migrate:deploy    # Apply migrations (production)

# Admin user setup
# Windows PowerShell:
$env:ADMIN_PASSWORD='sua_senha'; npm run seed:admin
# Linux/macOS:
ADMIN_PASSWORD='sua_senha' npm run seed:admin

# Build and deploy
npm run build                    # Build for production
npm run start                    # Start production server
npm run lint                     # Run ESLint
```

## Architecture

### Data Model (Prisma)
- **User**: Users of the system (ADMIN or USER role)
- **Professional**: Healthcare professionals (doctors, specialists) with active/inactive status
- **Consultation**: Central entity linking User + Professional + date + notes (Markdown) + Files
- **File**: Uploaded documents (PDF) and images (PNG/JPG) attached to consultations

Key relationships:
- User → Consultations (1:N)
- Professional → Consultations (1:N)
- Consultation → Files (1:N)
- Professional → Files (1:N) - for filtering files by professional

### Authentication (NextAuth.js)
- Credentials-based authentication (email/password with bcrypt)
- JWT session strategy
- User roles: ADMIN and USER
- Custom sign-in page: `/auth/signin`
- Session data includes: `id`, `email`, `name`, `role`
- Auth configuration: `lib/auth/config.ts`

### File Upload System
- Upload directory: `process.env.FILES_PATH` or `./uploads`
- Allowed types: PDF, PNG, JPG (max 10MB per file)
- Unique filenames: `{uuid}.{extension}`
- Access via: `/api/files/{filename}`
- Implementation: `lib/upload.ts`

### App Structure (Next.js App Router)
```
app/
├── api/                      # API routes
│   ├── auth/                 # NextAuth endpoints + /me
│   ├── consultations/        # CRUD for consultations
│   ├── professionals/        # CRUD for professionals
│   ├── files/                # File upload and serving
│   ├── users/                # User management (ADMIN only)
│   └── admin/stats/          # Admin statistics
├── consultations/            # Consultation pages (list, detail, new)
├── professionals/            # Professional pages (list, detail, new)
├── reports/                  # Reports/timeline view
├── admin/                    # Admin panel
└── auth/signin/              # Sign-in page

lib/
├── auth/                     # Auth config and utilities
├── prisma/client.ts          # Singleton Prisma client
├── upload.ts                 # File upload utilities
├── responses.ts              # API response helpers
└── errors.ts                 # Error handling

components/
├── providers.tsx             # React providers (SessionProvider)
└── navigation.tsx            # Navigation component
```

## Key Patterns

1. **Professional Status**: Only `isActive: true` professionals appear in selection lists for new consultations. Inactive professionals remain in history but cannot be selected.

2. **Quick Professional Creation**: Forms for creating consultations allow inline creation of professionals without full details.

3. **File Associations**: Files belong to both a Consultation and a Professional (for filtering).

4. **Markdown Support**: Consultation notes support Markdown formatting.

5. **Cascade Deletes**: Deleting a user cascades to their consultations; deleting a consultation cascades to its files.

## Environment Variables

Required in `.env`:
```
DATABASE_URL=mysql://user:password@hostname:port/database
NEXTAUTH_SECRET=                 # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
FILES_PATH=/data/uploads         # Optional, defaults to ./uploads
```

## Docker Deployment

The project is designed for Docker deployment (e.g., Unraid):
- Dockerfile builds a standalone Next.js app
- Volume mount required for `FILES_PATH`
- Database should be external MariaDB 11+ instance
- Build command: `docker build -t medlog .`
