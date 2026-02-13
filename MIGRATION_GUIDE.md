# Migration Guide: From Convex to Railway

This guide will help you migrate from Convex to Railway with Express.js backend and PostgreSQL database.

## Overview

The migration involves:
1. Setting up a new Express.js backend with PostgreSQL
2. Deploying the backend to Railway
3. Updating the frontend to use REST API instead of Convex
4. Removing Convex dependencies

## Backend Setup (Already Completed)

The backend has been created in the `backend/` directory with:
- Express.js server
- PostgreSQL database integration
- Clerk authentication
- Document management API
- Railway deployment configuration

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to https://railway.app/
2. Sign up with GitHub

### 1.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub repository
4. Select the `backend` directory

### 1.3 Add PostgreSQL Database
1. Click "New" in your Railway project
2. Select "Database" → "PostgreSQL"
3. Wait for the database to provision

### 1.4 Configure Environment Variables
In Railway dashboard, add these variables:
```
CLERK_PUBLISHABLE_KEY=pk_test_ZGVhci1tb2xlLTc5LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_qfBpbDTkaP4EOD2NA6HioM6cPlM1uRKbKwskdU7coI
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### 1.5 Run Database Migration
After first deployment, run:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migration
railway run npm run build && railway run npm run migrate
```

### 1.6 Get Your API URL
After deployment, Railway will provide a URL like:
`https://your-app.up.railway.app`

Copy this URL for the next steps.

## Step 2: Update Frontend

### 2.1 Update Environment Variables

Update `.env.local`:
```env
# Remove or comment out Convex
# NEXT_PUBLIC_CONVEX_URL=...

# Add Railway backend URL
NEXT_PUBLIC_API_URL=https://your-app.up.railway.app

# Keep Clerk credentials
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZGVhci1tb2xlLTc5LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_qfBpbDTkaP4EOD2NA6HioM6cPlM1uRKbKwskdU7coI
NEXT_PUBLIC_CLERK_ACCOUNT_URL=https://dear-mole-79.accounts.dev
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Keep Liveblocks
LIVEBLOCKS_SECRET_KEY=your-liveblocks-secret-key
```

### 2.2 Install Dependencies

The new API client is already created. No new dependencies needed.

### 2.3 Remove Convex Dependencies

```bash
npm uninstall convex
```

### 2.4 Update Components

The following files need to be updated to use the new API:

#### Files to Update:
1. `src/components/convex-client-provider.tsx` → Simplify to just Clerk provider
2. `src/app/(home)/page.tsx` → Use `useDocuments` hook
3. `src/app/(home)/documents-table.tsx` → Update Document type
4. `src/app/(home)/document-row.tsx` → Use new Document type
5. `src/app/(home)/document-menu.tsx` → Use API client for mutations
6. `src/app/documents/[documentId]/page.tsx` → Fetch from API
7. `src/app/documents/[documentId]/document.tsx` → Use new data structure
8. `src/app/documents/[documentId]/navbar.tsx` → Use API for updates
9. `src/components/rename-dialog.tsx` → Use API client
10. `src/components/remove-dialog.tsx` → Use API client

Would you like me to update these files automatically?

## Step 3: Update Document ID Format

### Important: ID Format Change

Convex uses string IDs like: `"jh7x1234567890abcdef"`
Railway/PostgreSQL uses numeric IDs: `1, 2, 3...`

This means:
1. **Document URLs will change** from `/documents/jh7x...` to `/documents/1`
2. **Existing links will break** - this is expected during migration
3. **Liveblocks room IDs** may need adjustment

### Migration Strategy:

**Option A: Fresh Start (Recommended)**
- Start with a clean slate
- All users create new documents
- Simpler and cleaner

**Option B: Data Migration**
- Export documents from Convex
- Import to PostgreSQL
- Update Liveblocks room references
- More complex but preserves data

## Step 4: Delete Convex Files

After verifying everything works:

```bash
# Remove Convex directory
rm -rf convex/

# Remove Convex config
rm liveblocks.config.ts

# Update .gitignore to remove convex references
```

## Step 5: Test the Migration

### 5.1 Test Authentication
- Sign in with Clerk
- Verify you can access the dashboard

### 5.2 Test Document Operations
- Create a new document
- Edit document title
- Search for documents
- Delete a document

### 5.3 Test Collaboration
- Open a document
- Verify Liveblocks collaboration still works
- Test with multiple users

### 5.4 Test Organizations
- Switch between personal and organization contexts
- Verify document visibility is correct

## Rollback Plan

If you need to rollback:

1. Restore Convex URL in `.env.local`
2. Run `npm install convex@1.17.3`
3. Restore Convex provider in components
4. Redeploy

## Benefits of Migration

✅ Full control over your backend
✅ Standard PostgreSQL database
✅ Can use any PostgreSQL tools/clients
✅ RESTful API architecture
✅ Easier to extend and customize
✅ No vendor lock-in
✅ Free Railway starter plan

## Cost Comparison

**Convex Free Tier:**
- Limited requests
- Vendor lock-in

**Railway Free Tier:**
- $5 free credit per month
- More flexibility
- Standard PostgreSQL

## Support

If you encounter issues:

1. Check Railway logs in dashboard
2. Check browser console for errors
3. Verify environment variables
4. Check database connection
5. Review API endpoint responses

## Next Steps

After successful migration:

1. Update documentation
2. Notify team members
3. Update deployment guides
4. Monitor Railway metrics
5. Set up database backups

## Questions?

Common issues:

**Q: Authentication not working?**
A: Verify Clerk keys in both frontend and backend

**Q: CORS errors?**
A: Check FRONTEND_URL in Railway environment variables

**Q: Database connection fails?**
A: Verify DATABASE_URL is automatically set by Railway

**Q: Can't create documents?**
A: Check Railway logs for error messages
