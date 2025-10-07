# Implementation Plan - MedLog

## Project Overview
MedLog is a medical consultation and exam records management system designed for family use. The system allows users to register medical consultations, upload PDFs and images of exam results, reports, prescriptions, and manage healthcare professionals.

## Technology Stack

**Language/Version**: TypeScript 5+ (Node.js 20+)

**Primary Dependencies**: Express.js, Next.js 14+, Prisma, NextAuth.js

**Storage**: MariaDB 11+

**Project Type**: Full-stack web application

### Framework Details
- **Backend:** Node.js with Express.js
- **Frontend:** React with Next.js 14+ (App Router)
- **UI Library:** shadcn/ui + Tailwind CSS
- **ORM:** Prisma

### Additional Technologies
- **Authentication:** OAuth 2.0 (Google) via NextAuth.js
- **File Upload:** Multer
- **Containerization:** Docker (Multi-stage build)
- **Registry:** ghcr.io/edalcin/medlog
- **Deployment:** Unraid (Docker container)

## Core Features

### 1. Consultation Registration (Central Event)
**The consultation registration is the central event of the system.**

Workflow:
1. User provides consultation date and selects healthcare professional
2. Professional selection via pulldown (shows only active professionals)
3. Quick professional creation: if not in list, user can type name directly
4. Free-text notes with Markdown support
5. Upload documents (PDF, images) during or after registration
6. Files are associated with both consultation AND professional

### 2. Healthcare Professionals Management
- Complete professional record: name, specialty, CRM, phones, address
- Active/Inactive status (only active shown in pulldown)
- Quick creation during consultation (name only, complete later)
- Edit to complete missing information

### 3. Medical Consultations
- Register consultations with date, professional, specialty, and notes
- Link consultations to users and professionals
- Free-text notes field with Markdown support
- Filter by date, specialty, and professional
- Timeline view of consultations

### 4. File Management
- Upload PDFs, PNG, JPG/JPEG files (max 10MB)
- Files linked to consultation AND professional
- Download and view functionality
- Multiple files per consultation

### 5. Multi-Perspective File Viewing
**Files can be viewed from three perspectives:**
- **By Consultation:** All files from a specific consultation
- **By Professional:** All files across all consultations with that professional
- **By Specialty:** All files from consultations of a specific specialty

### 6. Reports and Analytics
- Consultations by professional (with totals and file counts)
- Consultations by specialty
- Consultations by period (day/month/year)
- Complete patient history report

### 7. Admin Dashboard
- User management
- View all consultations, professionals, and files
- System statistics

## Architecture

### Database Schema
- **users:** User accounts with OAuth data
- **health_professionals:** Healthcare professional records
- **consultations:** Medical consultation records
- **consultation_files:** Uploaded files linked to consultations
- **sessions:** User session management
- **audit_logs:** System audit trail

### API Endpoints
- `/auth/*` - Authentication routes
- `/api/users` - User management (admin)
- `/api/professionals` - Healthcare professionals CRUD
- `/api/consultations` - Consultations CRUD
- `/api/files` - File upload/download/delete
- `/api/dashboard` - Dashboard statistics

### Frontend Structure
- App Router architecture (Next.js 14+)
- Server-side rendering where appropriate
- Mobile-first responsive design
- Clean, modern UI with shadcn/ui components

## Environment Variables

Required Docker environment variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - MariaDB connection
- `FILES_PATH` - Path for uploaded files
- `NODE_ENV` - Environment (production/development)
- `APP_URL` - Application URL
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` - OAuth config
- `SESSION_SECRET`, `JWT_SECRET` - Security secrets
- `ADMIN_EMAIL` - First admin user email

## Development Phases

### Phase 1: Setup & Foundation (Week 1)
- [ ] Initialize project structure
- [ ] Configure database and Prisma schema
- [ ] Setup Docker configuration
- [ ] Implement Google OAuth authentication
- [ ] Create basic UI layout and navigation

### Phase 2: Core Features (Week 2)
- [ ] Healthcare professionals CRUD
- [ ] Consultations CRUD (without files)
- [ ] User management (admin)
- [ ] Basic filtering and search

### Phase 3: File Management (Week 3)
- [ ] File upload functionality
- [ ] File download and viewing
- [ ] Thumbnail generation for images
- [ ] PDF viewer integration

### Phase 4: Polish & Deploy (Week 4)
- [ ] UI/UX refinements
- [ ] Testing (integration tests)
- [ ] Documentation (README with Unraid instructions)
- [ ] CI/CD setup (GitHub Actions)
- [ ] First release to ghcr.io

## Key Decisions

**Architecture:** Monolith (frontend + backend in single container)  
**Responsiveness:** Desktop first  
**Editor:** Markdown support for consultation notes  
**PDF Viewing:** Embedded viewer (PDF.js) + download option  
**Specialties:** Hybrid (predefined list + custom option)  
**HTTPS:** Cloudflare Tunnel for production, HTTP for local testing  
**Audit Logs:** Not in MVP  
**Testing:** Basic unit tests  
**Dark Mode:** Not in MVP (future enhancement)

## Success Criteria

- Users can log in via Google OAuth
- Admin can manage users by email
- Healthcare professionals can be added and managed
- Consultations can be created with Markdown notes
- Files (PDF, images) can be uploaded and viewed
- PDFs can be viewed in embedded viewer
- System runs in Docker on Unraid
- Data persists in MariaDB
- Files persist in mounted volume
- Basic search and filtering works
- Desktop-responsive interface
- Thumbnails generated for images

## Future Enhancements

- Markdown editor for notes
- Full-text search in consultation notes
- Automatic backup functionality
- Dark mode
- Consultation reminders/notifications
- Report export (PDF generation)
- Multi-language support
- PWA (installable app)

---

**Status:** Planning Complete  
**Start Date:** 2025-01-07  
**Target Completion:** 2025-02-04 (4 weeks)
