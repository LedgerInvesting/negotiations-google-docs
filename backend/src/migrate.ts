import { pool } from './config/database';

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration...');
    
    // Create documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        initial_content TEXT,
        owner_id VARCHAR(255) NOT NULL,
        room_id VARCHAR(255),
        organization_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_owner_id ON documents(owner_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_organization_id ON documents(organization_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_title_search ON documents USING gin(to_tsvector('english', title));
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
