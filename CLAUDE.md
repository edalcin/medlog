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

# Seed scripts
# Admin user setup:
# Windows PowerShell:
$env:ADMIN_PASSWORD='sua_senha'; npm run seed:admin
# Linux/macOS:
ADMIN_PASSWORD='sua_senha' npm run seed:admin

npm run seed:categories          # Seed default file categories
npm run seed:specialties         # Seed default medical specialties
npm run seed:clinics             # Seed default clinics/hospitals
npm run fix:professionals        # Associate default specialty to existing professionals

# Build and deploy
npm run build                    # Build for production
npm run start                    # Start production server
npm run lint                     # Run ESLint
```

## Architecture

### Data Model (Prisma)
- **User**: Users of the system (ADMIN or USER role)
- **Professional**: Healthcare professionals with active/inactive status, multiple specialties, and optional clinic association
- **Specialty**: Medical specialties dictionary (e.g., Cardiologia, Ortopedia)
- **ProfessionalSpecialty**: N:N junction table linking professionals to specialties
- **Clinic**: Clinics/hospitals dictionary (e.g., Hospital Particular, UBS)
- **Consultation**: Central entity linking User + Professional + date + notes (Markdown) + Files
- **File**: Uploaded documents (PDF) and images (PNG/JPG) with categorization
- **FileCategory**: File category dictionary (e.g., Laudo, Receita, Pedido de Exame)

Key relationships:
- User → Consultations (1:N)
- Professional → Consultations (1:N)
- Professional ↔ Specialty (N:N via ProfessionalSpecialty)
- Professional → Clinic (N:1, optional)
- Consultation → Files (1:N)
- FileCategory → Files (1:N)
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
├── api/                            # API routes
│   ├── auth/                       # NextAuth endpoints + /me
│   ├── consultations/              # CRUD for consultations
│   ├── professionals/              # CRUD for professionals
│   ├── files/                      # File upload and serving
│   ├── users/                      # User management (ADMIN only)
│   ├── file-categories/            # File category dictionary management
│   │   └── [id]/                   # PUT/DELETE category by ID
│   ├── specialties/                # Medical specialty dictionary management
│   │   └── [id]/                   # PUT/DELETE specialty by ID
│   ├── clinics/                    # Clinic/hospital dictionary management
│   │   └── [id]/                   # PUT/DELETE clinic by ID
│   └── admin/                      # Admin-only endpoints
│       ├── stats/                  # Statistics
│       ├── consultations/          # List all consultations
│       │   └── bulk-delete/        # Bulk delete consultations
│       └── professionals/          # List all professionals
│           └── bulk-delete/        # Bulk delete professionals
├── consultations/                  # Consultation pages (list, detail, new)
├── professionals/                  # Professional pages (list, detail, new)
├── reports/                        # Reports/timeline view
├── admin/                          # Admin panel (6 tabs)
└── auth/signin/                    # Sign-in page

lib/
├── auth/                           # Auth config and utilities
├── prisma/client.ts                # Singleton Prisma client
├── upload.ts                       # File upload utilities
├── responses.ts                    # API response helpers
└── errors.ts                       # Error handling

components/
├── providers.tsx                   # React providers (SessionProvider)
└── navigation.tsx                  # Navigation component

scripts/
├── seed-admin.ts                   # Create admin user
├── seed-file-categories.ts         # Seed default file categories
├── seed-specialties.ts             # Seed default specialties
├── seed-clinics.ts                 # Seed default clinics/hospitals
└── fix-professionals-add-default-specialty.ts  # Migration helper
```

## Key Patterns

1. **Professional Status**: Only `isActive: true` professionals appear in selection lists for new consultations. Inactive professionals remain in history but cannot be selected.

2. **Quick Professional Creation**: Forms for creating consultations allow inline creation of professionals without full details.

3. **Multiple Specialties**: Professionals can have multiple specialties via N:N relationship. Inline creation of new specialties is supported during professional registration.

4. **File Categorization**: Files must be categorized when uploaded (e.g., Laudo, Receita). Inline creation of new categories is supported during file upload.

5. **Controlled Dictionaries**: Both file categories and medical specialties are managed through controlled dictionaries in the admin panel.

6. **File Associations**: Files belong to both a Consultation and a Professional (for filtering), plus a FileCategory for organization.

7. **Markdown Support**: Consultation notes support Markdown formatting.

8. **Cascade Deletes**: Deleting a user cascades to their consultations; deleting a consultation cascades to its files. Professional-Specialty associations cascade on delete.

9. **Referential Integrity**: Dictionaries (categories, specialties) cannot be deleted if in use. Professionals cannot be bulk-deleted if they have consultations.

10. **Admin Panel Organization**: Admin panel has 7 tabs:
    - Users: Full CRUD for system users
    - Consultations: View all + bulk delete
    - Professionals: View all + bulk delete (with validation)
    - Specialties: Full CRUD for specialty dictionary
    - Categories: Full CRUD for file category dictionary
    - Clinics: Full CRUD for clinic/hospital dictionary
    - Files: View all files with metadata

11. **Clinic Association**: Professionals can optionally be associated with a clinic/hospital from a controlled dictionary. Inline creation is supported during professional registration.

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
