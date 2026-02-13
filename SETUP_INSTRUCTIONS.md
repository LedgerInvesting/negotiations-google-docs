# Setup Instructions - Railway Backend Migration

## What Has Been Created

I've set up a complete Express.js backend with PostgreSQL to replace Convex. Here's what's ready:

### Backend Structure (`/backend`)
```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # PostgreSQL connection
│   ├── middleware/
│   │   └── auth.ts               # Clerk authentication
│   ├── models/
│   │   └── document.ts           # Document database model
│   ├── routes/
│   │   └── documents.ts          # REST API endpoints
│   ├── index.ts                  # Express server
│   └── migrate.ts                # Database migration script
├── package.json
├── tsconfig.json
├── railway.json                  # Railway deployment config
├── .env.example
└── README.md
```

### Frontend Updates
- `src/lib/api-client.ts` - REST API client
- `src/hooks/use-documents.ts` - React hooks for API calls
- Updated `.env.local` with new API URL

### Documentation
- `backend/README.md` - Backend documentation
- `MIGRATION_GUIDE.md` - Complete migration guide
- `SETUP_INSTRUCTIONS.md` - This file

## Quick Start (Local Development)

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Local PostgreSQL

You need a PostgreSQL database. Options:

**Option A: Local PostgreSQL**
```bash
# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Create database
createdb negotiations_docs
```

**Option B: Docker**
```bash
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=negotiations_docs \
  -p 5432:5432 \
  -d postgres:15
```

**Option C: Railway PostgreSQL (Recommended)**
- Create a Railway account
- Create a new PostgreSQL database
- Copy the DATABASE_URL

### 3. Configure Environment

The `.env` file is already created in `backend/`. Update if needed:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/negotiations_docs
CLERK_PUBLISHABLE_KEY=pk_test_ZGVhci1tb2xlLTc5LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_qfBpbDTkaP4EOD2NA6HioM6cPlM1uRKbKwskdU7coI
NODE_ENV=development
```

### 4. Run Database Migration

```bash
cd backend
npm run build
npm run migrate
```

You should see: "Migration completed successfully!"

### 5. Start Backend Server

```bash
npm run dev
```

Server will start at: http://localhost:3001

Test it:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 6. Start Frontend

In a new terminal:

```bash
# In project root
npm run dev
```

Frontend will start at: http://localhost:3000

## Deploy to Railway

### Option 1: Railway Dashboard

1. **Create Account**: https://railway.app/
2. **New Project** → "Deploy from GitHub repo"
3. **Select your repository**
4. **Add PostgreSQL**:
   - Click "New" → "Database" → "PostgreSQL"
5. **Set Root Directory**:
   - Go to service settings
   - Set "Root Directory" to `backend`
6. **Add Environment Variables**:
   ```
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NODE_ENV=production
   FRONTEND_URL=https://your-app.vercel.app
   ```
7. **Run Migration**:
   - After first deployment
   - Use Railway CLI: `railway run npm run migrate`

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
cd backend
railway init

# Link database
railway add --database postgresql

# Deploy
railway up

# Run migration
railway run npm run migrate

# Get URL
railway domain
```

## Update Frontend for Production

After deploying to Railway, update `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-app.up.railway.app
```

Then deploy your Next.js app to Vercel as usual.

## Testing the Setup

### Test Backend Endpoints

```bash
# Get auth token from Clerk
TOKEN="your_clerk_token"

# Test documents API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/documents

# Create document
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Document"}' \
  http://localhost:3001/api/documents
```

### Test Frontend

1. Start both backend and frontend
2. Sign in with Clerk
3. Try creating a document
4. Search for documents
5. Delete a document

## Current State vs. Complete Migration

### ✅ Completed
- Backend Express server created
- PostgreSQL schema defined
- API endpoints implemented
- Authentication with Clerk
- React hooks for API calls
- Local development environment configured

### ⚠️ To Complete Migration
- Update all frontend components to use new API
- Replace Convex hooks with custom hooks
- Update document ID format (string → number)
- Remove Convex dependencies: `npm uninstall convex`
- Delete `convex/` directory
- Test all functionality

## Next Steps

### For Complete Migration:

1. **Deploy Backend to Railway** (follow steps above)

2. **Update Frontend Components** - These files need updates:
   - `src/components/convex-client-provider.tsx`
   - `src/app/(home)/page.tsx`
   - `src/app/(home)/documents-table.tsx`
   - `src/app/(home)/document-row.tsx`
   - `src/app/(home)/document-menu.tsx`
   - `src/app/documents/[documentId]/page.tsx`
   - `src/app/documents/[documentId]/document.tsx`
   - `src/app/documents/[documentId]/navbar.tsx`
   - `src/components/rename-dialog.tsx`
   - `src/components/remove-dialog.tsx`

3. **Test Everything**

4. **Remove Convex**:
   ```bash
   npm uninstall convex
   rm -rf convex/
   ```

5. **Update Production Environment**

## Important Notes

### ID Format Change
- **Before**: Convex used string IDs like `"jh7x1234567890"`
- **After**: PostgreSQL uses numeric IDs like `1`, `2`, `3`
- **Impact**: Document URLs will change, existing links will break
- **Recommendation**: Start fresh or migrate data manually

### Database Schema
```sql
documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  initial_content TEXT,
  owner_id VARCHAR(255),
  room_id VARCHAR(255),
  organization_id VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Environment Variables Summary

**Backend (.env)**:
- `PORT` - Server port (3001)
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS (production only)

**Frontend (.env.local)**:
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `LIVEBLOCKS_SECRET_KEY` - Liveblocks key

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify DATABASE_URL is correct
- Check port 3001 is available

### Database migration fails
- Ensure PostgreSQL is accessible
- Check database exists
- Verify user has correct permissions

### Authentication errors
- Verify Clerk keys are correct in both backend and frontend
- Check token is being sent in Authorization header

### CORS errors
- Verify FRONTEND_URL in production
- Check API_URL in frontend .env

## Getting Help

- Backend documentation: `backend/README.md`
- Migration guide: `MIGRATION_GUIDE.md`
- Railway docs: https://docs.railway.app/
- Clerk docs: https://clerk.com/docs

## Summary

You now have:
1. ✅ A complete Express.js backend ready for Railway
2. ✅ PostgreSQL database schema
3. ✅ REST API with authentication
4. ✅ React hooks for API calls
5. ✅ Local development environment
6. ⚠️ Frontend components need updating to use new API

Would you like me to update the frontend components to complete the migration?
