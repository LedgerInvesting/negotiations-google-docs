# Backend Migration: Convex → PostgreSQL + WebSockets

This project has been migrated from Convex to a custom backend using PostgreSQL and WebSockets.

## Architecture Overview

- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: WebSocket server (ws protocol) on port 3001
- **API**: Next.js API routes (REST endpoints)
- **Auth**: Clerk (unchanged)
- **Frontend State**: SWR for data fetching and caching

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL Database

You can use a local PostgreSQL instance or a cloud provider (Supabase, Neon, Railway, etc.)

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb negotiations_docs
```

#### Option B: Cloud PostgreSQL
Sign up for a provider and get your connection string.

### 3. Configure Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in the values:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/negotiations_docs"

# Clerk Authentication (from your Clerk dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Liveblocks (for real-time collaboration)
LIVEBLOCKS_SECRET_KEY=sk_...

# Backend URLs (default for local development)
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 4. Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# OR create a migration (for production)
npm run db:migrate
```

### 5. Run the Application

The custom server runs both Next.js and the WebSocket server:

```bash
# Development
npm run dev

# Production
npm run build
npm run start:prod
```

The application will be available at:
- **Next.js App**: http://localhost:3000
- **WebSocket Server**: ws://localhost:3001

## Key Changes from Convex

### Data Fetching

**Before (Convex):**
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

const documents = useQuery(api.documents.get, { search });
const create = useMutation(api.documents.create);
```

**After (PostgreSQL + SWR):**
```typescript
import { useDocuments, useCreateDocument } from "@/hooks/use-documents";

const { results, status, loadMore } = useDocuments(search);
const { create, isLoading } = useCreateDocument();
```

### Real-time Updates

**Before**: Convex provided automatic real-time subscriptions

**After**: WebSocket client automatically reconnects and triggers SWR revalidation on updates

### Document IDs

**Before**: Convex generated IDs like `Id<"documents">`

**After**: Standard string IDs (cuid format)

### Authentication

Clerk integration remains the same - no changes needed.

## API Endpoints

### Documents

- `GET /api/documents` - List documents with pagination
  - Query params: `search`, `cursor`, `limit`
- `POST /api/documents` - Create document
- `GET /api/documents/[id]` - Get single document
- `PATCH /api/documents/[id]` - Update document
- `DELETE /api/documents/[id]` - Delete document
- `POST /api/documents/by-ids` - Get multiple documents by IDs

## Database Schema

```prisma
model Document {
  id              String    @id @default(cuid())
  title           String
  initialContent  String?
  ownerId         String
  roomId          String?
  organizationId  String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([ownerId])
  @@index([organizationId])
  @@index([title])
}
```

## WebSocket Events

The WebSocket server broadcasts document events:

```typescript
{
  type: 'created' | 'updated' | 'deleted',
  data: Document | { id: string }
}
```

## Development Tools

```bash
# View database in Prisma Studio
npm run db:studio

# Generate Prisma Client after schema changes
npm run db:generate

# Create a new migration
npm run db:migrate

# Push schema without migration (dev only)
npm run db:push
```

## Deployment Considerations

### Environment Variables
Make sure to set all environment variables in your deployment platform:
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `LIVEBLOCKS_SECRET_KEY`
- `NEXT_PUBLIC_WS_URL` (your WebSocket server URL)
- `NEXT_PUBLIC_API_URL` (your API URL)

### WebSocket Server
The WebSocket server runs on port 3001. Make sure:
1. Port 3001 is exposed/accessible
2. Your firewall/security groups allow WebSocket connections
3. Update `NEXT_PUBLIC_WS_URL` to point to your deployed WebSocket server

### Database
1. Run migrations: `npm run db:migrate`
2. Ensure connection pooling is configured for production
3. Consider using a connection pooler like PgBouncer for serverless deployments

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check if PostgreSQL is running
- Ensure database exists
- Check firewall rules

### WebSocket Connection Issues
- Verify `NEXT_PUBLIC_WS_URL` is correct
- Check if port 3001 is accessible
- Look for CORS or security policy issues

### Prisma Issues
```bash
# Reset Prisma Client
rm -rf node_modules/.prisma
npm run db:generate
```

## Migration Checklist

- [x] Set up PostgreSQL database
- [x] Create Prisma schema
- [x] Build REST API endpoints
- [x] Implement WebSocket server
- [x] Create custom React hooks (SWR-based)
- [x] Update all components
- [x] Remove Convex dependencies
- [ ] Test all features
- [ ] Deploy to production

## Support

For issues or questions, please refer to:
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [SWR Docs](https://swr.vercel.app)
- [ws (WebSocket) Docs](https://github.com/websockets/ws)
