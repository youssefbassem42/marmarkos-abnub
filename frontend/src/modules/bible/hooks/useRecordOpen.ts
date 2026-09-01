import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { bibleApi } from "../api";

export function useRecordOpen(verseId: string | undefined) {
  const hasRecorded = useRef(false);

  const mutation = useMutation({
    mutationFn: (id: string) => bibleApi.recordOpen(id),
  });

  useEffect(() => {
    if (!verseId || hasRecorded.current) return;
    hasRecorded.current = true;
    mutation.mutate(verseId);
  }, [verseId, mutation]);
}
