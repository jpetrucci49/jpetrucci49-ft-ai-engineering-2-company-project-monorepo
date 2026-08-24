"use client";

import { useCallback, useEffect, useState } from "react";

import { toUserFacingMessage } from "@healthcore/api/errors";

export function useReloadableResource<T>(
  load: () => Promise<T>,
  fallbackMessage: string,
  initial: T
) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await load();
        if (!cancelled) setData(result);
      } catch (caught) {
        if (!cancelled) {
          setData(initial);
          setError(toUserFacingMessage(caught, fallbackMessage));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [fallbackMessage, initial, load, reloadToken]);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { data, error, isLoading, retry };
}
