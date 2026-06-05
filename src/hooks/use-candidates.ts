"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Candidate } from "@/lib/types";

interface UseCandidatesOptions {
  search?: string;
  status?: string;
  pollingInterval?: number;
}

interface UseCandidatesReturn {
  candidates: Candidate[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCandidates({
  search = "",
  status = "",
  pollingInterval = 10000,
}: UseCandidatesOptions = {}): UseCandidatesReturn {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const res = await fetch(`/api/candidates?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch candidates");
      }
      const data = await res.json();
      setCandidates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (isFirstLoad.current) {
        setIsLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, [search, status]);

  const fetchRef = useRef(fetchCandidates);
  useEffect(() => {
    fetchRef.current = fetchCandidates;
  }, [fetchCandidates]);

  useEffect(() => {
    isFirstLoad.current = true;
    setIsLoading(true);
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    const interval = setInterval(() => fetchRef.current(), pollingInterval);
    return () => clearInterval(interval);
  }, [pollingInterval]);

  return { candidates, isLoading, error, refetch: fetchCandidates };
}
