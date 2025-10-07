# Data Model

**Feature**: MedLog - Sistema de Registro de Consultas Médicas
**Date**: 7 de outubro de 2025

This document defines the data entities, their relationships, and validation rules for the MedLog system.

## Entities Overview

The system manages medical consultation records with associated professionals and files, accessed by authenticated users.

## Entity Definitions

### User (Usuário)
Represents a system user authenticated via Google OAuth.

**Fields**:
- `id`: String (UUID) - Primary key
- `email`: String - Gmail address, unique
- `name`: String - Display name from Google
- `googleId`: String - Google OAuth ID, unique
- `role`: Enum - 'admin' | 'user' (default: 'user')
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Validation Rules**:
- Email must be valid Gmail address
- GoogleId must be unique
- Only one admin user (first login becomes admin)

**Relationships**:
- One-to-many with Consultation (user can have many consultations)

### Professional (Profissional)
Represents healthcare professionals that can be associated with consultations.

**Fields**:
- `id`: String (UUID) - Primary key
- `name`: String - Required, not unique (duplicates allowed)
- `specialty`: String - Required
- `crm`: String - Optional
- `phone`: String - Optional
- `address`: String - Optional
- `isActive`: Boolean - Default: true
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Validation Rules**:
- Name and specialty are required
- CRM, phone, address are optional
- No uniqueness constraints (allows duplicate names)

**Relationships**:
- One-to-many with Consultation (professional can have many consultations)
- One-to-many with File (professional can have many associated files)

### Consultation (Consulta)
Represents a medical consultation record.

**Fields**:
- `id`: String (UUID) - Primary key
- `date`: DateTime - Required
- `notes`: String - Optional, supports Markdown
- `userId`: String (UUID) - Foreign key to User
- `professionalId`: String (UUID) - Foreign key to Professional
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Validation Rules**:
- Date must be valid and not in future
- UserId and professionalId must reference existing records
- Professional must be active when creating consultation
- Notes can be empty

**Relationships**:
- Many-to-one with User
- Many-to-one with Professional
- One-to-many with File (consultation can have many files)

### File (Arquivo)
Represents uploaded documents or images associated with consultations.

**Fields**:
- `id`: String (UUID) - Primary key
- `filename`: String - Original filename
- `path`: String - Filesystem path relative to FILES_PATH
- `mimeType`: String - File MIME type (PDF, PNG, JPG)
- `size`: Int - File size in bytes
- `consultationId`: String (UUID) - Foreign key to Consultation
- `professionalId`: String (UUID) - Foreign key to Professional
- `uploadedAt`: DateTime

**Validation Rules**:
- Only PDF, PNG, JPG allowed
- Maximum file size: 10MB (configurable)
- Path must be within allowed directory
- ConsultationId and professionalId must reference existing records

**Relationships**:
- Many-to-one with Consultation
- Many-to-one with Professional

## Database Schema (Prisma)

```prisma
model User {
  id        String @id @default(uuid())
  email     String @unique
  name      String
  googleId  String @unique
  role      UserRole @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  consultations Consultation[]

  @@map("users")
}

model Professional {
  id        String @id @default(uuid())
  name      String
  specialty String
  crm       String?
  phone     String?
  address   String?
  isActive  Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  consultations Consultation[]
  files         File[]

  @@map("professionals")
}

model Consultation {
  id             String @id @default(uuid())
  date           DateTime
  notes          String?
  userId         String
  professionalId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User @relation(fields: [userId], references: [id], onDelete: Cascade)
  professional Professional @relation(fields: [professionalId], references: [id])
  files        File[]

  @@map("consultations")
}

model File {
  id             String @id @default(uuid())
  filename       String
  path           String
  mimeType       String
  size           Int
  consultationId String
  professionalId String
  uploadedAt     DateTime @default(now())

  consultation Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  professional Professional @relation(fields: [professionalId], references: [id])

  @@map("files")
}

enum UserRole {
  ADMIN
  USER
}
```

## Data Integrity Rules

1. **User Deletion**: Cascade delete consultations and files
2. **Professional Deletion**: Prevent if has associated consultations (soft delete by setting inactive)
3. **Consultation Deletion**: Cascade delete associated files
4. **File Deletion**: Physical file removal from filesystem
5. **Active Professional Check**: Only active professionals shown in dropdown, but existing consultations remain valid

## Indexes

- Users: email, googleId
- Professionals: name, specialty, isActive
- Consultations: userId, professionalId, date
- Files: consultationId, professionalId

## Migration Strategy

Initial migration creates all tables with constraints. Future migrations for:
- Adding optional fields
- Index optimizations
- Data type changes (if needed)