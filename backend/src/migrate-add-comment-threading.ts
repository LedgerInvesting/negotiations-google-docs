import { pool } from './config/database';

async function migrateAddCommentThreading() {
  try {
    console.log('Starting comment threading migration...');

    // Add parent_id column to comments table
    await pool.query(`
      ALTER TABLE comments 
      ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE
    `);

    console.log('✅ Added parent_id column to comments table');

    // Add an index for faster queries of replies
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)
    `);

    console.log('✅ Created index on parent_id column');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateAddCommentThreading();
