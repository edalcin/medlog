# MedLog - Deployment & URL Configuration

## Overview

MedLog uses environment variables to configure the application URL for both development and production environments. This ensures the application works correctly regardless of where it's deployed.

## URL Configuration

### Development (Local)

When running locally with `npm run dev`, the application uses:

```
NEXTAUTH_URL=http://localhost:3000
```

This is configured in `.env.local` and allows:
- Login functionality
- API calls
- Session management
- NextAuth.js callback URLs

**Development Process:**
```bash
npm install
npx prisma db push
npm run dev
# Application runs at http://localhost:3000
```

### Production (Docker/Container)

When deployed as a Docker container (e.g., in Unraid), the application **always** runs on the URL defined in the `NEXTAUTH_URL` environment variable.

**Example Configuration:**

```yaml
# docker-compose.yml or Unraid container environment
environment:
  - NEXTAUTH_URL=https://medlog.yourdomain.com
  - NEXTAUTH_SECRET=<your-secure-random-secret>
  - DATABASE_URL=mysql://user:password@db-host:3306/medlog
  - FILES_PATH=/data/uploads
  - NODE_ENV=production
```

**Container Port Mapping:**
```yaml
ports:
  - "3000:3000"  # Container exposes port 3000
```

Then access via your configured `NEXTAUTH_URL`.

## How It Works

### NextAuth.js Integration

NextAuth.js automatically uses the `NEXTAUTH_URL` environment variable for:

1. **OAuth/Credentials Callbacks** - Redirects after login
2. **Session Management** - Token validation and refresh
3. **API Routes** - `/api/auth/*` endpoints
4. **Client-side Auth Hooks** - `useSession()` refresh

### API Calls

All API calls in the application use relative paths starting with `/api`:

```typescript
// Frontend code (automatically uses current origin)
const response = await fetch('/api/consultations')

// Works correctly on any domain because it's relative
// Development: http://localhost:3000/api/consultations
// Production: https://medlog.yourdomain.com/api/consultations
```

### URL Helper Functions

The application includes a URL helper in `lib/url.ts`:

```typescript
import { getBaseUrl, getApiUrl } from '@/lib/url'

// Get the base URL (respects environment)
const baseUrl = getBaseUrl()
// Development: http://localhost:3000
// Production: https://medlog.yourdomain.com

// Get full API URL (rarely needed due to relative paths)
const fullUrl = getApiUrl('/api/consultations')
```

## Environment Variables Reference

### Required Variables

| Variable | Development | Production | Purpose |
|----------|-------------|------------|---------|
| `NEXTAUTH_URL` | `http://localhost:3000` | Your custom domain | Base URL for authentication |
| `NEXTAUTH_SECRET` | `medlog_nextauth_secret_for_local_development` | **MUST be random!** | Session encryption key |
| `DATABASE_URL` | Local/network DB | Production DB connection | Database access |
| `NODE_ENV` | `development` | `production` | Environment flag |

### Optional Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FILES_PATH` | `./uploads` | File storage directory |
| `PORT` | `3000` | Server port |
| `FILES_PATH` | `/app/data/uploads` | Docker file path |

## Security Best Practices

### For Production Deployment

1. **Never use localhost URLs in production**
   ```
   ❌ NEXTAUTH_URL=http://localhost:3000
   ✅ NEXTAUTH_URL=https://medlog.yourdomain.com
   ```

2. **Generate strong NEXTAUTH_SECRET**
   ```bash
   # Generate secure random string
   openssl rand -base64 32
   ```

3. **Use HTTPS in production**
   - All authentication cookies are secure by default in production
   - Requires proper SSL/TLS setup

4. **Keep environment variables private**
   - Never commit `.env.local` or `.env.production` with secrets
   - Use Unraid environment variables or external secret management

## Testing URL Configuration

### Development
```bash
# Start development server
npm run dev

# Test login at
# http://localhost:3000/auth/signin

# Test API at
# http://localhost:3000/api/auth/me
```

### Production (Docker)
```bash
# Build image
docker build -t medlog .

# Run with custom NEXTAUTH_URL
docker run \
  -e NEXTAUTH_URL=https://medlog.yourdomain.com \
  -e NEXTAUTH_SECRET=<generated-secret> \
  -e DATABASE_URL=mysql://... \
  -p 3000:3000 \
  medlog

# Test login at
# https://medlog.yourdomain.com/auth/signin

# Test API at
# https://medlog.yourdomain.com/api/auth/me
```

## Troubleshooting

### "Invalid NEXTAUTH_URL"
- Ensure `NEXTAUTH_URL` matches the URL you're accessing
- Don't mix HTTP/HTTPS
- Make sure protocol is included (http:// or https://)

### Login redirects to wrong URL
- Check `NEXTAUTH_URL` environment variable
- Verify domain/port in variable matches your actual access URL
- Restart container/application after changing URL

### API calls fail with 401
- Verify session is valid
- Check `NEXTAUTH_SECRET` is same across restarts
- Confirm `NEXTAUTH_URL` matches request origin

### CORS errors in console
- Normal if using relative API paths (ignore)
- Check if API returns proper CORS headers

## Files Reference

- **Auth Config**: `lib/auth/config.ts` - NextAuth.js configuration
- **Auth Route**: `app/api/auth/[...nextauth]/route.ts` - Auth API
- **URL Helper**: `lib/url.ts` - URL utility functions
- **Environment Example**: `.env.example` - Template for environment variables
- **Development Config**: `.env.local` - Local development settings
