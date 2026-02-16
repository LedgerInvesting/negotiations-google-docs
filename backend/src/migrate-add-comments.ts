import { pool } from './config/database';

async function addCommentsTable() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        comment_id VARCHAR(255) UNIQUE NOT NULL,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        author_id VARCHAR(255) NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_document_id 
      ON comments(document_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_comment_id 
      ON comments(comment_id)
    `);

    await client.query('COMMIT');
    console.log('✅ Comments table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating comments table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
addCommentsTable()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
