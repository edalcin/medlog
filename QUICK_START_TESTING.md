# Quick Start Testing Guide

**Status**: ✅ Ready to Test Locally

## Prerequisites

- Node.js installed
- MariaDB database accessible via DATABASE_URL
- `.env` file configured with:
  - DATABASE_URL
  - NEXTAUTH_SECRET
  - NEXTAUTH_URL (optional for local dev)
  - FILES_PATH (optional, defaults to ./uploads)

## Step 1: Install Dependencies

```bash
cd H:\git\medlog
npm install
```

**Expected Output**:
- Dependencies installed
- node_modules created
- No errors

## Step 2: Sync Database

```bash
npx prisma generate
npx prisma db push
```

**Expected Output**:
- Prisma Client generated
- Schema synced to database
- "✓ Database synced" message

## Step 3: Start Development Server

```bash
npm run dev
```

**Expected Output**:
```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
- Environments: .env.local, .env

✓ Starting...
✓ Ready in ~1000ms
```

**Access at**: http://localhost:3000

## Step 4: Login

1. Open http://localhost:3000 in browser
2. You'll be redirected to login page
3. Use credentials:
   - Admin user: `admin@example.com` / (your ADMIN_PASSWORD)
   - Regular user: Create one via admin panel

## Step 5: Test File Management

### Create Test User (As Admin)

1. Navigate to `/admin`
2. Go to "Users" tab
3. Click "Create new user"
4. Create a test user account
5. Note the email and password

### Upload Test File (As Regular User)

1. Logout (if admin)
2. Login with test user account
3. Navigate to "Arquivos" (Files) in menu
4. Click "Upload" or "Novo Arquivo"
5. Upload a PDF or image file
6. Select a category
7. Click Upload
8. Verify success message

### Test Duplicate Detection

1. Try uploading the same file again
2. Should get error: "Este arquivo já foi enviado"
3. This confirms duplicate detection works

### Test File Listing

1. Navigate to `/files`
2. Verify file appears in list
3. Try searching by filename
4. Try filtering by category
5. Try sorting by different columns

### Test Edit & Delete

1. Click "Edit" on a file
2. Change the custom name
3. Click Save
4. Verify changes appear in list
5. Click "Delete"
6. Confirm deletion
7. Verify file removed from list

### Test Authorization

1. Note a file ID from URL
2. Logout
3. Login with different user
4. Try accessing `/files/[id]/edit` directly
5. Should get authorization error

## Step 6: Run Integrity Check

```bash
npm run check:files:integrity
```

**Expected Output**:
```
🔍 Verificando integridade dos arquivos...

📁 Diretório de uploads: ./uploads

📊 Total de arquivos no banco: X

📈 Resumo:
✅ Arquivos encontrados: X
❌ Arquivos faltando: 0
📊 Total no banco: X
```

**Should show**: 0 missing files and 0 orphaned files

## Common Issues & Solutions

### Issue: Database connection fails
**Solution**:
```bash
# Verify DATABASE_URL in .env is correct
# Test connection:
npx prisma db execute --stdin < "SELECT 1"
```

### Issue: Files not appearing in list
**Solution**:
```bash
# Check database has records
npx prisma db execute --stdin < "SELECT COUNT(*) FROM File;"

# Check filesystem has files
dir uploads/  (Windows)
ls -la uploads/  (Linux/Mac)
```

### Issue: Duplicate detection not working
**Solution**:
- Ensure browser supports Web Crypto API (modern browsers)
- Check browser console for JavaScript errors
- Clear browser cache and try again

### Issue: File upload fails with size error
**Solution**:
- Check file is under 10MB
- Verify FILES_PATH directory exists and is writable
- Check disk space available

### Issue: Cannot login to admin panel
**Solution**:
```bash
# Create admin user with password
ADMIN_PASSWORD='your_secure_password' npm run seed:admin

# Login with:
# Email: admin@example.com
# Password: your_secure_password
```

### Issue: File categories not showing
**Solution**:
```bash
# Seed default categories
npm run seed:categories
```

## Testing Checklist (Quick Version)

- [ ] Dev server starts without errors
- [ ] Can login to system
- [ ] Can navigate to `/files` page
- [ ] Can upload a file successfully
- [ ] Duplicate detection prevents re-upload
- [ ] File appears in list
- [ ] Can search for file by name
- [ ] Can filter by category
- [ ] Can sort by different columns
- [ ] Can edit file name/category
- [ ] Can delete file with confirmation
- [ ] Cannot access other user's files
- [ ] Integrity check shows 0 orphaned files
- [ ] Admin can see all users' files
- [ ] Regular user sees only own files

## After Testing

### If All Tests Pass ✅
```bash
git -C "H:\git\medlog" push origin main
```

### If Issues Found ❌
```bash
# Make fixes and commit
git -C "H:\git\medlog" add .
git -C "H:\git\medlog" commit -m "fix: description of fix"

# Or reset to previous state
git -C "H:\git\medlog" reset --hard HEAD~2
```

## Helpful Commands

```bash
# Check git status
git status

# View recent commits
git log --oneline -10

# Check for uncommitted changes
git diff

# View database records
npx prisma studio  # Opens Prisma UI at http://localhost:5555

# View logs for development
npm run dev  # Ctrl+C to stop

# Full build test
npm run build

# Type checking only
npx tsc --noEmit

# Clean cache and rebuild
rm -r .next
npm run build
```

## File Locations

**Important Directories:**
- Upload directory: `./uploads` (or $FILES_PATH)
- App pages: `app/`
- API routes: `app/api/`
- Database: MariaDB (via DATABASE_URL)

**Key Files:**
- Schema: `prisma/schema.prisma`
- Auth config: `lib/auth/config.ts`
- Upload config: `lib/upload.ts`

## Expected API Response Times

- File upload: < 2 seconds (depends on file size)
- File list load: < 500ms
- File edit: < 500ms
- Duplicate detection: < 1 second
- File delete: < 1 second

## Success Indicators

✅ **Server**:
- Dev server starts in < 2 seconds
- No errors in console
- Middleware loads successfully

✅ **Database**:
- Schema synced
- Tables created
- Data queries responsive

✅ **UI**:
- Pages load without errors
- Forms submit successfully
- Modals display correctly
- Filters work in real-time

✅ **Files**:
- Upload succeeds
- Files appear in list
- Duplicates detected
- Deletion removes files
- Integrity check passes

## Estimated Testing Time

- Basic smoke test: 10-15 minutes
- Comprehensive testing: 30-45 minutes
- Full regression testing: 1-2 hours

## Support & Documentation

**Main Documents:**
- `TESTING.md` - Comprehensive testing guide
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `CLAUDE.md` - Project overview
- `DEPLOYMENT.md` - Docker deployment info

**Quick Reference:**
- `README.md` - Installation basics
- `package.json` - Available npm scripts
