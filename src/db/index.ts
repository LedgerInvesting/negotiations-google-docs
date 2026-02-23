import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// for query purposes
const queryClient = postgres(process.env.DATABASE_URL!, {
  // Railway PostgreSQL requires SSL in production
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  // Connection pool settings for production
  max: process.env.NODE_ENV === 'production' ? 10 : 1,
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(queryClient, { schema });

// Export schema for use in queries
export { schema };
