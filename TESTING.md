# Testing Guide - File Management System Refactor

**Status**: Ready for local testing
**Build Status**: ✅ Successful
**Commits**: 2 local commits ready to test

## Overview

This document provides a comprehensive testing guide for the complete file management refactor. The system has been modified to move file management from admin-only to a user-centric design with proper data isolation and duplicate detection.

## What Was Changed

### 1. **Data Model**
- Made `File.consultationId` optional (was required)
- Added `File.hash` field for duplicate detection (SHA-256)
- Files can now be associated with:
  - Consultation only
  - Professional only
  - Both consultation and professional (auto-associates to consulting professional)

### 2. **File Management Pages**
- **`/files`** - Main file listing (was only in admin panel)
  - Lists only user's own files (ADMIN sees all)
  - Filterable by: name, category, sort by name/date/size, ascending/descending
  - Clickable modal showing full file details and associations
  - Edit and Delete buttons for each file

- **`/files/new`** - Upload new file
  - Drag-and-drop upload
  - SHA-256 hash calculation with visual feedback
  - Associate to professional (optional) OR consultation (optional, but at least one required)
  - Select file category
  - Custom rename field
  - Duplicate detection (returns 409 error with helpful message)

- **`/files/[id]/edit`** - Edit existing file
  - Rename file (customName)
  - Change category
  - Change associated professional
  - Delete with confirmation
  - Shows current associations (consultation date, professional name)

### 3. **API Endpoints**
- `GET /api/files/user` - List user files with pagination
- `POST /api/files/upload` - Upload with duplicate detection
- `GET /api/files/[id]` - Get file details
- `PUT /api/files/[id]` - Update file metadata
- `DELETE /api/files/[id]/delete` - Delete file
- `GET /api/files/download/[path]` - Download file (authorization check: owner or admin)

### 4. **Navigation**
- Added "Arquivos" link in main menu (appears for all authenticated users, not admin-only)

### 5. **Data Isolation**
- Fixed issue where user "edalcin" couldn't see their records after role change to USER
- Migration script ran: `scripts/fix-edalcin-data.ts` (reassigned 47 professionals and 7 clinics)
- All API endpoints now properly filter by userId with role-based access control

## Testing Checklist

### Phase 1: Basic Access & Navigation

- [ ] **Login as regular USER (non-admin)**
  - Verify you can access `/files` route
  - Verify "Arquivos" appears in navigation menu
  - Verify dashboard shows correctly (no login redirect)

- [ ] **Login as ADMIN user**
  - Verify you can access `/files` route
  - Verify you can see ALL files in the system (not just your own)
  - Verify "Arquivos" appears in navigation menu

- [ ] **Verify data isolation**
  - Login as User A, create a file
  - Logout and login as User B
  - Verify User B cannot see User A's files
  - Login as ADMIN
  - Verify ADMIN can see both users' files

### Phase 2: File Upload & Duplicate Detection

- [ ] **Upload new file as regular user**
  - Navigate to `/files/new`
  - Select a file to upload
  - Verify hash is calculated (should see status message)
  - Select a professional (optional)
  - Select a category
  - Enter a custom name
  - Click upload
  - Verify success message and redirect to `/files`

- [ ] **Upload same file again (duplicate detection)**
  - Try uploading the same file a second time
  - Verify you get error: "Este arquivo já foi enviado"
  - Verify error includes the existing file's customName

- [ ] **Upload multiple file types**
  - Upload PDF
  - Upload PNG/JPG image
  - Verify all work correctly
  - Verify file type detection works

- [ ] **Test file size validation**
  - Try uploading a file > 10MB
  - Verify error message appears
  - Verify error message is clear about size limit

### Phase 3: File Listing & Filtering

- [ ] **View file list**
  - Navigate to `/files`
  - Verify all your uploaded files appear in list
  - Verify columns: Name, Category, Professional, Upload Date, Size

- [ ] **Search by name**
  - Enter text in search box
  - Verify list filters in real-time
  - Verify results match your search term

- [ ] **Filter by category**
  - Select a category from dropdown
  - Verify only files in that category appear
  - Select "All" to reset

- [ ] **Sort by different fields**
  - Click "Sort by Name" - verify alphabetical order
  - Click "Sort by Date" - verify chronological order
  - Click "Sort by Size" - verify size order
  - Click "Ascending/Descending" toggle - verify order reverses

- [ ] **View file details modal**
  - Click on a file in the list
  - Modal should show:
    - File name and custom name
    - Category
    - File size and upload date
    - Associated consultation (if any) with date
    - Associated professional name
    - Download, Edit, Delete buttons

### Phase 4: File Edit & Rename

- [ ] **Edit file metadata**
  - Click Edit button on a file
  - Navigate to `/files/[id]/edit`
  - Verify current metadata is displayed
  - Change custom name
  - Change category
  - Change associated professional
  - Click Save
  - Verify success message
  - Verify changes appear on file list

- [ ] **Edit without changing anything**
  - Click Edit on a file
  - Click Save without making changes
  - Verify no error occurs

### Phase 5: File Deletion

- [ ] **Delete file**
  - Click Delete button on a file
  - Verify confirmation modal appears
  - Verify modal shows file name and warns about deletion
  - Click Cancel - verify modal closes and file remains
  - Click Delete again
  - Click Confirm - verify file is deleted
  - Verify file no longer appears in list

- [ ] **Verify file physically deleted**
  - Run: `npm run check:files:integrity`
  - Verify deleted file doesn't appear in orphaned files report
  - Verify database and filesystem are in sync

### Phase 6: File Download & Associations

- [ ] **Download file**
  - Click on file name or download link
  - Verify file downloads correctly
  - Verify file is readable (PDF opens in browser, image displays, etc.)

- [ ] **File associated with consultation**
  - Create a consultation with file attachment
  - Navigate to `/files`
  - Find the uploaded file
  - Click modal to view details
  - Verify consultation date appears
  - Click consultation link - should navigate to consultation details page
  - Verify file is listed in consultation's files

- [ ] **File associated with professional**
  - Upload a file directly (without consultation)
  - Select a professional during upload
  - Navigate to `/files`
  - View file details
  - Verify professional name appears
  - Verify no consultation is shown

### Phase 7: Admin Panel Integration

- [ ] **Admin file viewing**
  - Login as ADMIN
  - Navigate to `/admin`
  - Verify "Files" tab shows all files in system (not just admin's)
  - Verify you can see files from all users
  - Verify deletion from admin panel works

- [ ] **Admin access to user files**
  - As ADMIN, navigate to `/files`
  - Verify you see all files in the system
  - Verify you can edit/delete any file
  - Verify you can view all associations

### Phase 8: Authorization & Security

- [ ] **User cannot access other user's files**
  - Login as User A
  - Note file ID from URL bar (e.g., `/files/[id]/edit`)
  - Logout and login as User B
  - Try to access User A's file via direct URL
  - Verify 403 Forbidden error or 404 Not Found

- [ ] **User can download own files**
  - Login as User A
  - Navigate to `/files`
  - Try downloading own file
  - Verify success

- [ ] **User cannot download other user's file**
  - Get a file download URL from User A's file
  - Logout and login as User B
  - Try to access download URL
  - Verify 403 Forbidden error

### Phase 9: Edge Cases

- [ ] **Upload same file with different name**
  - Upload file "document.pdf"
  - Upload same file again as "document_copy.pdf"
  - Verify duplicate detection catches this (same hash)

- [ ] **Very large file list**
  - If you have many files, verify pagination works
  - Verify sorting still works with large dataset

- [ ] **Special characters in filename**
  - Upload file with special characters in name
  - Verify it uploads correctly
  - Verify it displays correctly in list

- [ ] **Empty file upload**
  - Try uploading empty file (if possible)
  - Verify proper error handling

### Phase 10: Data Integrity

- [ ] **Run integrity check script**
  ```bash
  npm run check:files:integrity
  ```
  - Verify no missing files reported
  - Verify no orphaned files reported
  - Verify total counts match expectations

- [ ] **Check database consistency**
  - Verify files with userId point to real users
  - Verify files with consultationId point to real consultations
  - Verify files with professionalId point to real professionals

## Known Issues to Watch For

1. **File Path Configuration** - If running in Docker, verify `FILES_PATH` environment variable is set correctly
2. **Hash Calculation** - SHA-256 calculation happens on client; ensure browser supports Web Crypto API
3. **Duplicate Detection** - Based on hash + userId combination; files for different users can have same hash

## Testing Environment Setup

### Local Development
```bash
# Install dependencies
npm install

# Sync database schema
npx prisma db push

# Start dev server
npm run dev
```

### Database Reset (if needed)
```bash
# Warning: This will delete all data
npx prisma migrate reset
npx prisma db push
```

### Seed Test Data
```bash
# Create admin user
ADMIN_PASSWORD='your_password' npm run seed:admin

# Create test files (manual upload through UI recommended)
```

## Rollback Plan

If critical issues are found during testing:

```bash
# Return to previous commit
git reset --hard HEAD~2

# Or return to last pushed state
git reset --hard origin/main
```

## Success Criteria

Testing is successful when:

✅ All files are properly isolated by user (except for ADMIN viewing all)
✅ Duplicate detection prevents uploading same file twice
✅ All CRUD operations work without errors
✅ File metadata editing works correctly
✅ Deletion removes both database record and physical file
✅ Authorization prevents unauthorized access
✅ No orphaned files in filesystem
✅ All associations (consultation, professional) display correctly
✅ Navigation menu shows file management option
✅ No database errors or constraint violations

## Committing to Remote

Once testing is successful:

```bash
# Push to origin/main (in main branch)
git push origin main
```

**DO NOT push until local testing confirms:**
- No critical bugs
- All major features working
- No data loss or corruption
- Authorization working properly
