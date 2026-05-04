"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RunItemChange {
  id: string;
  run_id: string;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  is_visible: boolean;
  manual_override: boolean;
}

export function useRealtimeRun(
  runId: string | null,
  onUpdate: () => void
) {
  useEffect(() => {
    if (!runId) return;

    const channel = supabase
      .channel(`run:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "run_items",
          filter: `run_id=eq.${runId}`,
        },
        (payload: RealtimePostgresChangesPayload<RunItemChange>) => {
          console.log("Run item changed:", payload);
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId, onUpdate]);
}

export function useRealtimeContainerRuns(
  householdId: string | null,
  onNewRun: (run: { container_id: string; started_by: string }) => void
) {
  useEffect(() => {
    if (!householdId) return;

    const channel = supabase
      .channel(`household-runs:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "container_runs",
        },
        (payload) => {
          console.log("New run started:", payload);
          if (payload.new) {
            onNewRun(payload.new as { container_id: string; started_by: string });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, onNewRun]);
}
