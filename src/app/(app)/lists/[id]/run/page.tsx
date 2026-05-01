"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RunChecklist } from "@/components/run-checklist";
import { getContainer } from "@/lib/actions/containers";
import { startRun, getActiveRun, type RunWithItems } from "@/lib/actions/runs";
import type { ContainerWithItems } from "@/lib/types/containers";

export default function ListRunPage() {
  const params = useParams();
  const listId = params.id as string;

  const [list, setList] = useState<ContainerWithItems | null>(null);
  const [run, setRun] = useState<RunWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [listData, activeRun] = await Promise.all([
        getContainer(listId),
        getActiveRun(listId),
      ]);

      if (!listData) {
        setError("List not found");
        return;
      }

      setList(listData);

      if (activeRun) {
        // Resume existing run
        setRun(activeRun);
      } else {
        // Start run immediately - lists don't need context capture
        await startRun(listId, {});
        const runWithItems = await getActiveRun(listId);
        setRun(runWithItems);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    const activeRun = await getActiveRun(listId);
    setRun(activeRun);
  }, [listId]);

  const handleStartNew = async () => {
    setLoading(true);
    try {
      await startRun(listId, {});
      const runWithItems = await getActiveRun(listId);
      setRun(runWithItems);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-950">
            <p className="text-red-600 dark:text-red-400">{error || "List not found"}</p>
            <Link href="/lists" className="mt-2 inline-block text-sm underline">
              Back to Lists
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/lists/${listId}`}
            className="mb-2 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
          >
            ← Back to List
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{list.name}</h2>
              {list.description && (
                <p className="mt-1 text-sm text-zinc-500">
                  {list.description}
                </p>
              )}
            </div>
            {run?.completed_at && (
              <Button variant="outline" onClick={handleStartNew}>
                Start Again
              </Button>
            )}
          </div>
        </div>

        {/* Run Checklist */}
        {run && (
          <RunChecklist
            run={run}
            containerType="list"
            onUpdate={handleRefresh}
          />
        )}
      </div>
    </div>
  );
}
