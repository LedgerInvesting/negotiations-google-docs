import { pool } from './config/database';

async function migrateAddContent() {
  const client = await pool.connect();
  
  try {
    console.log('Adding content column...');
    
    // Add content column (separate from initial_content)
    await client.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS content TEXT;
    `);
    
    // Copy initial_content to content for existing documents
    await client.query(`
      UPDATE documents 
      SET content = initial_content 
      WHERE content IS NULL;
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

migrateAddContent();
