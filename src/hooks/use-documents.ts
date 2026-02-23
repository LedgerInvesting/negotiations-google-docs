"use client";

import useSWR from 'swr';
import { useState, useCallback } from 'react';
import { useWebSocket } from '@/lib/websocket-client';

export interface Document {
  id: string;
  title: string;
  initialContent?: string | null;
  ownerId: string;
  roomId?: string | null;
  organizationId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type PaginationStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'Exhausted';

interface DocumentsResponse {
  documents: Document[];
  nextCursor: string | null;
  hasMore: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export function useDocuments(search?: string) {
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const cursorParam = cursor ? `&cursor=${cursor}` : '';
  
  const { data, error, isLoading, mutate } = useSWR<DocumentsResponse>(
    `/api/documents?limit=5${searchParam}${cursorParam}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Handle real-time updates via WebSocket
  useWebSocket(useCallback((event: { type: string }) => {
    if (event.type === 'created' || event.type === 'updated') {
      mutate(); // Revalidate the data
    } else if (event.type === 'deleted') {
      mutate(); // Revalidate the data
    }
  }, [mutate]));

  // Update local state when data changes
  if (data && data.documents) {
    if (cursor === null) {
      // First load
      if (JSON.stringify(allDocuments) !== JSON.stringify(data.documents)) {
        setAllDocuments(data.documents);
        setHasMore(data.hasMore);
      }
    } else {
      // Load more
      const newDocs = data.documents.filter(
        (doc) => !allDocuments.find((d) => d.id === doc.id)
      );
      if (newDocs.length > 0) {
        setAllDocuments((prev) => [...prev, ...newDocs]);
        setHasMore(data.hasMore);
      }
    }
  }

  const loadMore = useCallback(() => {
    if (data?.nextCursor && hasMore) {
      setCursor(data.nextCursor);
    }
  }, [data?.nextCursor, hasMore]);

  return {
    results: cursor === null ? data?.documents : allDocuments,
    status: (isLoading ? 'LoadingFirstPage' : hasMore ? 'CanLoadMore' : 'Exhausted') as PaginationStatus,
    loadMore,
    error,
  };
}

export function useDocument(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Document>(
    id ? `/api/documents/${id}` : null,
    fetcher
  );

  // Handle real-time updates via WebSocket
  useWebSocket(useCallback((event: { type: string; data: { id?: string } }) => {
    if (event.type === 'updated' && event.data.id === id) {
      mutate(); // Revalidate the data
    } else if (event.type === 'deleted' && event.data.id === id) {
      mutate(); // Revalidate the data
    }
  }, [id, mutate]));

  return {
    document: data,
    isLoading,
    error,
  };
}

export function useCreateDocument() {
  const [isLoading, setIsLoading] = useState(false);

  const create = useCallback(async (data: { title?: string; initialContent?: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to create document');
      
      const document = await res.json();
      return document.id;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { create, isLoading };
}

export function useUpdateDocument() {
  const [isLoading, setIsLoading] = useState(false);

  const update = useCallback(async (id: string, data: { title: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to update document');
      
      return await res.json();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { update, isLoading };
}

export function useDeleteDocument() {
  const [isLoading, setIsLoading] = useState(false);

  const remove = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete document');
      
      return await res.json();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { remove, isLoading };
}

export async function getDocumentsByIds(ids: string[]) {
  const res = await fetch('/api/documents/by-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (!res.ok) throw new Error('Failed to fetch documents');
  
  return res.json() as Promise<Array<{ id: string; name: string }>>;
}
