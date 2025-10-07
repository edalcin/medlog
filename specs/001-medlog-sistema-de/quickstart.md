# Quick Start Guide

**Feature**: MedLog - Sistema de Registro de Consultas Médicas
**Date**: 7 de outubro de 2025

This guide provides quick setup instructions for developers to get the MedLog application running locally.

## Prerequisites

- Node.js 20+ installed
- MariaDB 10.5+ running locally or via Docker
- Git

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd medlog
npm install
```

### 2. Database Setup

Create a MariaDB database and user:

```sql
CREATE DATABASE medlog;
CREATE USER 'medlog'@'localhost' IDENTIFIED BY 'medlog';
GRANT ALL PRIVILEGES ON medlog.* TO 'medlog'@'localhost';
FLUSH PRIVILEGES;
```

Or use Docker:

```bash
docker run --name mariadb-medlog \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=medlog \
  -e MYSQL_USER=medlog \
  -e MYSQL_PASSWORD=medlog \
  -p 3333:3306 \
  -d mariadb:10.11
```

### 3. Environment Configuration

Copy the provided `.env` file or create one with:

```bash
cp .env.example .env  # if example exists
# or create .env with required variables
```

Required environment variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `FILES_PATH` - local directory for file uploads
- `PORT` - application port (default: 3123)
- `APP_URL` - application URL
- `ADMIN_EMAIL` - admin Gmail address
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`

### 4. Database Migration

```bash
npx prisma generate
npx prisma db push
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3123`

### 6. First Admin Login

1. Open the application in browser
2. Click login with Google
3. Use the Gmail address specified in `ADMIN_EMAIL`
4. The first login automatically becomes admin

## Development Workflow

### Running Tests

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

### Database Management

```bash
npx prisma studio  # Open Prisma Studio
npx prisma db push # Apply schema changes
npx prisma migrate dev # Create migration
```

### Building for Production

```bash
npm run build
npm start
```

## Docker Deployment

### Build Image

```bash
docker build -t medlog .
```

### Run Container

```bash
docker run -d \
  --name medlog \
  -p 3123:3123 \
  -v /path/to/uploads:/app/uploads \
  --env-file .env \
  medlog
```

## Troubleshooting

### Database Connection Issues
- Verify MariaDB is running on correct port
- Check credentials in `.env`
- Ensure database and user exist

### Google OAuth Issues
- Verify client ID and secret are correct
- Check callback URL matches Google Console configuration
- Ensure domain is authorized in Google Console

### File Upload Issues
- Check `FILES_PATH` directory exists and is writable
- Verify Docker volume mounting if using containers
- Check file permissions

### Port Conflicts
- Change `PORT` in `.env` if 3123 is in use
- Update `APP_URL` and `GOOGLE_CALLBACK_URL` accordingly

## Development Tips

- Use `npm run dev` for hot reloading during development
- Check browser console and server logs for errors
- Use Prisma Studio for database inspection
- Run tests before committing changes

## Next Steps

After setup, you can:
1. Create additional user accounts via admin panel
2. Add sample professionals and consultations
3. Test file uploads and viewing
4. Customize UI styling as needed