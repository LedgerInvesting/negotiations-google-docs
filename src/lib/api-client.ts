export interface Document {
  id: number;
  title: string;
  initial_content?: string;
  content?: string;
  owner_id: string;
  room_id?: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginationResult {
  page: Document[];
  isDone: boolean;
  continueCursor: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private async getAuthHeaders(token: string | null): Promise<HeadersInit> {
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  async getDocuments(token: string | null, params: {
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginationResult> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.cursor) searchParams.append('cursor', params.cursor);

    const response = await fetch(
      `${API_URL}/api/documents?${searchParams.toString()}`,
      {
        headers: await this.getAuthHeaders(token),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    return response.json();
  }

  async getDocumentById(token: string | null, id: number): Promise<Document> {
    const response = await fetch(`${API_URL}/api/documents/${id}`, {
      headers: await this.getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }

    return response.json();
  }

  async getDocumentsByIds(token: string | null, ids: number[]): Promise<Array<{ id: number; name: string }>> {
    const response = await fetch(`${API_URL}/api/documents/by-ids`, {
      method: 'POST',
      headers: await this.getAuthHeaders(token),
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    return response.json();
  }

  async createDocument(token: string | null, data: {
    title?: string;
    initialContent?: string;
  }): Promise<Document> {
    const response = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers: await this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create document');
    }

    return response.json();
  }

  async updateDocument(token: string | null, id: number, data: { title?: string; content?: string }): Promise<Document> {
    const response = await fetch(`${API_URL}/api/documents/${id}`, {
      method: 'PATCH',
      headers: await this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update document');
    }

    return response.json();
  }

  async deleteDocument(token: string | null, id: number): Promise<void> {
    const response = await fetch(`${API_URL}/api/documents/${id}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
  }
}

export const apiClient = new ApiClient();
