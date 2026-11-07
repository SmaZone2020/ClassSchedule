import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface DailyWord {
  /** One line of poetry. */
  content: string;
  title: string;
  author: string;
}

export function useDailyWord() {
  const [word, setWord] = useState<DailyWord | null>(null);
  const [loading, setLoading] = useState(false);

  const next = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await invoke<DailyWord>("get_daily_word", { force: true });
      setWord(fresh);
      return fresh;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    invoke<DailyWord>("get_daily_word", { force: false })
      .then((first) => {
        if (alive) setWord(first);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return { word, loading, next };
}
