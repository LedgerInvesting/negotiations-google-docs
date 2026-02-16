import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, Document } from "@/lib/api-client";

interface UseDocumentsResult {
  results: Document[] | undefined;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: (numItems: number) => void;
  error: Error | null;
}

export function useDocuments(search?: string): UseDocumentsResult {
  const { getToken } = useAuth();
  const [results, setResults] = useState<Document[] | undefined>(undefined);
  const [status, setStatus] = useState<
    "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  >("LoadingFirstPage");
  const [cursor, setCursor] = useState<string>("0");
  const [error, setError] = useState<Error | null>(null);

  const fetchDocuments = useCallback(
    async (isLoadMore: boolean = false) => {
      try {
        if (isLoadMore) {
          setStatus("LoadingMore");
        }

        const token = await getToken();
        const data = await apiClient.getDocuments(token, {
          search,
          limit: 5,
          cursor: isLoadMore ? cursor : "0",
        });

        setResults((prev) => {
          if (isLoadMore && prev) {
            return [...prev, ...data.page];
          }
          return data.page;
        });

        if (data.isDone) {
          setStatus("Exhausted");
        } else {
          setStatus("CanLoadMore");
          if (data.continueCursor) {
            setCursor(data.continueCursor);
          }
        }
      } catch (err) {
        setError(err as Error);
        setStatus("Exhausted");
      }
    },
    [search, cursor],
  );

  useEffect(() => {
    setResults(undefined);
    setStatus("LoadingFirstPage");
    setCursor("0");
    fetchDocuments(false);
  }, [search]); // Only re-run when search changes

  const loadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      fetchDocuments(true);
    }
  }, [status, fetchDocuments]);

  return {
    results,
    status,
    loadMore,
    error,
  };
}

export function useDocument(id: number) {
  const { getToken } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const data = await apiClient.getDocumentById(token, id);

        setDocument(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [id, getToken]);

  return { document, loading, error };
}
