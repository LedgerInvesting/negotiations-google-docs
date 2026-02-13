import { pool } from '../config/database';

export interface Document {
  id: number;
  title: string;
  initial_content?: string;
  content?: string;
  owner_id: string;
  room_id?: string;
  organization_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentCreate {
  title?: string;
  initial_content?: string;
  owner_id: string;
  organization_id?: string;
}

export interface DocumentUpdate {
  title?: string;
  content?: string;
}

export interface PaginationResult {
  documents: Document[];
  hasMore: boolean;
  continueCursor: string | null;
}

export class DocumentModel {
  static async create(data: DocumentCreate): Promise<Document> {
    const result = await pool.query(
      `INSERT INTO documents (title, initial_content, owner_id, organization_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.title || 'Untitled document',
        data.initial_content,
        data.owner_id,
        data.organization_id,
      ]
    );
    return result.rows[0];
  }

  static async getById(id: number): Promise<Document | null> {
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async getByIds(ids: number[]): Promise<Document[]> {
    if (ids.length === 0) return [];
    
    const result = await pool.query(
      'SELECT * FROM documents WHERE id = ANY($1)',
      [ids]
    );
    return result.rows;
  }

  static async getPaginated(
    userId: string,
    organizationId: string | undefined,
    search: string | undefined,
    limit: number,
    offset: number
  ): Promise<PaginationResult> {
    let query: string;
    let params: any[];

    if (search) {
      if (organizationId) {
        // Search within organization
        query = `
          SELECT * FROM documents 
          WHERE organization_id = $1 
          AND to_tsvector('english', title) @@ plainto_tsquery('english', $2)
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4
        `;
        params = [organizationId, search, limit + 1, offset];
      } else {
        // Personal search
        query = `
          SELECT * FROM documents 
          WHERE owner_id = $1 
          AND to_tsvector('english', title) @@ plainto_tsquery('english', $2)
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4
        `;
        params = [userId, search, limit + 1, offset];
      }
    } else {
      if (organizationId) {
        // All docs in organization
        query = `
          SELECT * FROM documents 
          WHERE organization_id = $1 
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [organizationId, limit + 1, offset];
      } else {
        // All personal docs
        query = `
          SELECT * FROM documents 
          WHERE owner_id = $1 
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [userId, limit + 1, offset];
      }
    }

    const result = await pool.query(query, params);
    const hasMore = result.rows.length > limit;
    const documents = hasMore ? result.rows.slice(0, limit) : result.rows;
    
    return {
      documents,
      hasMore,
      continueCursor: hasMore ? String(offset + limit) : null,
    };
  }

  static async update(id: number, data: DocumentUpdate): Promise<Document | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(data.title);
      paramCount++;
    }

    if (data.content !== undefined) {
      updates.push(`content = $${paramCount}`);
      values.push(data.content);
      paramCount++;
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE documents 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async checkAccess(
    documentId: number,
    userId: string,
    organizationId?: string
  ): Promise<boolean> {
    const document = await this.getById(documentId);
    
    if (!document) return false;
    
    const isOwner = document.owner_id === userId;
    const isOrganizationMember =
      document.organization_id && document.organization_id === organizationId;
    
    return isOwner || !!isOrganizationMember;
  }
}
