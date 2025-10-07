# Tasks: MedLog - Sistema de Registro de Consultas Médicas

**Input**: Design documents from `/specs/001-medlog-sistema-de/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested in feature specification - tests are optional and not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Next.js full-stack**: `app/` for pages/routes, `lib/` for utilities, `prisma/` for database, `components/` for UI

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Next.js 14 project with TypeScript in repository root
- [x] T002 [P] Install core dependencies: Next.js, React, Prisma, Tailwind CSS
- [x] T003 [P] Install additional dependencies: authentication libraries, file upload utilities
- [x] T004 Create project structure per implementation plan (app/, components/, lib/, prisma/, etc.)
- [x] T005 Configure Tailwind CSS for styling
- [x] T006 Setup environment configuration (.env file and validation)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Setup Prisma with MariaDB connection and schema definition
- [x] T008 [P] Implement Google OAuth authentication framework in lib/auth/
- [x] T009 [P] Create base User model and authentication utilities
- [x] T010 [P] Create Professional model with validation
- [x] T011 [P] Create Consultation model with relationships
- [x] T012 [P] Create File model for attachments
- [x] T013 Setup API routing structure in app/api/
- [ ] T014 Configure file upload handling and storage utilities
- [ ] T015 Setup error handling and response utilities
- [ ] T016 Configure Next.js middleware for authentication

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Registrar Consulta Médica (Priority: P1) 🎯 MVP

**Goal**: Allow users to register medical consultations with date, professional selection, notes, and file attachments

**Independent Test**: Create a consultation with all fields and attachments, verify it appears in basic listing

### Implementation for User Story 1

- [ ] T017 [US1] Implement GET /api/professionals endpoint for active professionals list
- [ ] T018 [US1] Implement POST /api/consultations endpoint for consultation creation
- [ ] T019 [US1] Implement POST /api/consultations/[id]/files endpoint for file uploads
- [ ] T020 [US1] Create consultation registration form component in components/forms/ConsultationForm.tsx
- [ ] T021 [US1] Create file upload component in components/ui/FileUpload.tsx
- [ ] T022 [US1] Create professional selection dropdown component in components/ui/ProfessionalSelect.tsx
- [ ] T023 [US1] Create consultation registration page in app/consultations/new/page.tsx
- [ ] T024 [US1] Add consultation creation logic and form validation
- [ ] T025 [US1] Add file upload handling and validation (PDF, PNG, JPG only)
- [ ] T026 [US1] Implement automatic professional creation from text input
- [ ] T027 [US1] Add success feedback and navigation after consultation creation

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Gerenciar Profissionais de Saúde (Priority: P2)

**Goal**: Allow users to manage healthcare professionals (add, edit, activate/deactivate)

**Independent Test**: Create, edit, and deactivate professionals, verify changes in consultation registration

### Implementation for User Story 2

- [ ] T028 [US2] Implement GET /api/professionals endpoint with full listing (active and inactive)
- [ ] T029 [US2] Implement POST /api/professionals endpoint for professional creation
- [ ] T030 [US2] Implement PUT /api/professionals/[id] endpoint for professional updates
- [ ] T031 [US2] Implement DELETE /api/professionals/[id] endpoint for professional deactivation
- [ ] T032 [US2] Create professional management page in app/professionals/page.tsx
- [ ] T033 [US2] Create professional form component in components/forms/ProfessionalForm.tsx
- [ ] T034 [US2] Create professional list component in components/ui/ProfessionalList.tsx
- [ ] T035 [US2] Add professional CRUD operations and validation
- [ ] T036 [US2] Implement active/inactive status management
- [ ] T037 [US2] Add confirmation dialogs for deactivation

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 4 - Administração do Sistema (Priority: P2)

**Goal**: Provide administrative functions for user and file management

**Independent Test**: Admin can invite users and view system files

### Implementation for User Story 4

- [ ] T038 [US4] Implement GET /api/admin/users endpoint for user listing
- [ ] T039 [US4] Implement POST /api/admin/users endpoint for user invitation
- [ ] T040 [US4] Implement GET /api/admin/files endpoint for file management
- [ ] T041 [US4] Create admin dashboard page in app/admin/page.tsx
- [ ] T042 [US4] Create user invitation component in components/admin/UserInvite.tsx
- [ ] T043 [US4] Create file management component in components/admin/FileManager.tsx
- [ ] T044 [US4] Add admin role checking and access control
- [ ] T045 [US4] Implement Gmail-based user invitation system
- [ ] T046 [US4] Add file listing and organization features

**Checkpoint**: User Stories 1, 2, and 4 should all work independently

---

## Phase 6: User Story 3 - Visualizar e Filtrar Histórico Médico (Priority: P3)

**Goal**: Allow users to view and filter their medical history by date, professional, and specialty

**Independent Test**: View consultations with various filters and verify correct results

### Implementation for User Story 3

- [ ] T047 [US3] Implement GET /api/consultations endpoint with filtering (date, professional, specialty)
- [ ] T048 [US3] Implement GET /api/consultations/[id] endpoint for consultation details
- [ ] T049 [US3] Implement GET /api/files/[id] endpoint for file downloads
- [ ] T050 [US3] Create consultation history page in app/consultations/page.tsx
- [ ] T051 [US3] Create consultation detail view in app/consultations/[id]/page.tsx
- [ ] T052 [US3] Create filter components in components/ui/ConsultationFilters.tsx
- [ ] T053 [US3] Create consultation list component in components/ui/ConsultationList.tsx
- [ ] T054 [US3] Create timeline view component in components/ui/ConsultationTimeline.tsx
- [ ] T055 [US3] Add filtering logic and URL state management
- [ ] T056 [US3] Add file download functionality
- [ ] T057 [US3] Implement pagination for large result sets

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T058 [P] Add responsive design and mobile optimization
- [ ] T059 [P] Implement loading states and error handling UI
- [ ] T060 [P] Add accessibility features (ARIA labels, keyboard navigation)
- [ ] T061 Configure production build and Docker container
- [ ] T062 Add application logging and monitoring
- [ ] T063 Create README.md with installation and usage instructions
- [ ] T064 Add input validation and security hardening
- [ ] T065 Performance optimization and bundle analysis
- [ ] T066 Final UI/UX polish and consistency checks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P4 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Independent of other stories
- **User Story 4 (P2)**: Can start after Foundational - Independent of other stories
- **User Story 3 (P3)**: Can start after Foundational - May use components from US1/US2 but independently testable

### Within Each User Story

- API endpoints before UI components
- Core functionality before advanced features
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel
- API endpoints within a story can run in parallel
- UI components within a story can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch API endpoints together:
Task: "Implement GET /api/professionals endpoint"
Task: "Implement POST /api/consultations endpoint"
Task: "Implement POST /api/consultations/[id]/files endpoint"

# Launch UI components together:
Task: "Create consultation registration form component"
Task: "Create file upload component"
Task: "Create professional selection dropdown component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test consultation creation independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 4 → Test independently → Deploy/Demo
5. Add User Story 3 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (consultation registration)
   - Developer B: User Story 2 (professional management)
   - Developer C: User Story 4 (admin functions)
   - Developer D: User Story 3 (history viewing)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- File paths follow Next.js conventions
- Total tasks: 66 (Setup: 6, Foundational: 10, US1: 11, US2: 10, US4: 9, US3: 11, Polish: 9)