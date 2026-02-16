import { pool } from '../config/database';

export interface Comment {
  id: number;
  comment_id: string;
  document_id: number;
  text: string;
  author_id: string;
  author_name: string;
  parent_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CommentCreate {
  comment_id: string;
  document_id: number;
  text: string;
  author_id: string;
  author_name: string;
  parent_id?: number | null;
}

export interface CommentUpdate {
  text: string;
}

export class CommentModel {
  static async create(data: CommentCreate): Promise<Comment> {
    const result = await pool.query(
      `INSERT INTO comments (comment_id, document_id, text, author_id, author_name, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.comment_id, data.document_id, data.text, data.author_id, data.author_name, data.parent_id || null]
    );
    return result.rows[0];
  }

  static async getById(id: number): Promise<Comment | null> {
    const result = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async getByCommentId(commentId: string): Promise<Comment | null> {
    const result = await pool.query('SELECT * FROM comments WHERE comment_id = $1', [commentId]);
    return result.rows[0] || null;
  }

  static async getByDocumentId(documentId: number): Promise<Comment[]> {
    const result = await pool.query(
      'SELECT * FROM comments WHERE document_id = $1 ORDER BY created_at ASC',
      [documentId]
    );
    return result.rows;
  }

  static async update(commentId: string, data: CommentUpdate): Promise<Comment | null> {
    const result = await pool.query(
      `UPDATE comments 
       SET text = $1, updated_at = CURRENT_TIMESTAMP
       WHERE comment_id = $2
       RETURNING *`,
      [data.text, commentId]
    );
    return result.rows[0] || null;
  }

  static async delete(commentId: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM comments WHERE comment_id = $1', [commentId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async deleteByDocumentId(documentId: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM comments WHERE document_id = $1', [documentId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async getReplies(parentId: number): Promise<Comment[]> {
    const result = await pool.query(
      'SELECT * FROM comments WHERE parent_id = $1 ORDER BY created_at ASC',
      [parentId]
    );
    return result.rows;
  }

  static async getThreadsByDocumentId(documentId: number): Promise<Comment[]> {
    const result = await pool.query(
      'SELECT * FROM comments WHERE document_id = $1 ORDER BY created_at ASC',
      [documentId]
    );
    return result.rows;
  }
}
