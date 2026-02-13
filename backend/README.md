# Backend for Negotiations Google Docs

This is the Express.js backend for the Negotiations Google Docs application, designed to be deployed on Railway.

## Features

- RESTful API for document management
- PostgreSQL database with full-text search
- Clerk authentication integration
- Organization and personal document management
- Ready for Railway deployment

## Local Development

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Clerk account

### Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your credentials:
```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/negotiations_docs
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NODE_ENV=development
```

4. Run database migrations:
```bash
npm run build
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

The server will start on http://localhost:3001

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Documents
All document endpoints require authentication via Clerk.

- `GET /api/documents` - Get paginated documents
  - Query params: `search`, `limit`, `cursor`
  
- `POST /api/documents` - Create a new document
  - Body: `{ title?: string, initialContent?: string }`
  
- `GET /api/documents/:id` - Get a single document
  
- `POST /api/documents/by-ids` - Get multiple documents by IDs
  - Body: `{ ids: number[] }`
  
- `PATCH /api/documents/:id` - Update a document
  - Body: `{ title: string }`
  
- `DELETE /api/documents/:id` - Delete a document

## Railway Deployment

### Step 1: Create a Railway Account

1. Go to [Railway](https://railway.app/)
2. Sign up or log in

### Step 2: Create a New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account and select your repository
4. Choose the `backend` directory as the root directory

### Step 3: Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a PostgreSQL instance
4. The `DATABASE_URL` will be automatically available as an environment variable

### Step 4: Configure Environment Variables

In the Railway dashboard, add the following environment variables:

```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.vercel.app
```

Note: `DATABASE_URL` and `PORT` are automatically provided by Railway.

### Step 5: Run Database Migration

1. After the first deployment, open the Railway service
2. Go to the "Deployments" tab
3. Click on the latest deployment
4. Open the "Deploy Logs" tab
5. Run a one-time command to migrate the database:
   - In Railway dashboard, go to your service
   - Click on "Settings" → "Deploy"
   - Under "Custom Start Command", temporarily set: `npm run build && npm run migrate && npm start`
   - After migration completes, change it back to: `npm start`

Alternatively, you can use Railway CLI:
```bash
railway run npm run migrate
```

### Step 6: Deploy

Railway will automatically deploy your backend when you push to your repository.

The backend will be available at: `https://your-app.up.railway.app`

## Environment Variables Summary

### Required
- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Railway)
- `CLERK_SECRET_KEY` - Clerk secret key for authentication
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key

### Optional
- `PORT` - Server port (auto-provided by Railway, defaults to 3001)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS

## Database Schema

### documents table
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  initial_content TEXT,
  owner_id VARCHAR(255) NOT NULL,
  room_id VARCHAR(255),
  organization_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_owner_id ON documents(owner_id);
CREATE INDEX idx_organization_id ON documents(organization_id);
CREATE INDEX idx_title_search ON documents USING gin(to_tsvector('english', title));
```

## Troubleshooting

### Connection Issues
- Ensure your `DATABASE_URL` is correct
- Check that your Railway PostgreSQL service is running
- Verify Clerk credentials are correct

### Migration Issues
- Make sure to run migrations after the first deployment
- Check Railway logs for error messages

### CORS Issues
- Verify `FRONTEND_URL` is set correctly in production
- Check that your frontend URL is allowed in CORS configuration
