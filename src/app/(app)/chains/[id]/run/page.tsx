"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RunContextModal } from "@/components/run-context-modal";
import { RunChecklist } from "@/components/run-checklist";
import { getContainer, getHouseholdMembers } from "@/lib/actions/containers";
import { startRun, getActiveRun, type RunWithItems } from "@/lib/actions/runs";
import { hasConditionType } from "@/lib/utils/conditions";
import { useRealtimeRun } from "@/hooks/use-realtime-run";
import type { ContainerWithItems, Tag, WeatherCondition } from "@/lib/types/containers";

export default function ChainRunPage() {
  const router = useRouter();
  const params = useParams();
  const chainId = params.id as string;

  const [chain, setChain] = useState<ContainerWithItems | null>(null);
  const [run, setRun] = useState<RunWithItems | null>(null);
  const [showContextModal, setShowContextModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<
    { id: string; display_name: string | null; avatar_url: string | null }[]
  >([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  // Realtime updates
  useRealtimeRun(run?.id ?? null, () => {
    // Refresh run data when realtime update received
    handleRefresh();
    toast.info("Run updated by partner");
  });

  const loadData = useCallback(async () => {
    try {
      const [chainData, activeRun, membersData] = await Promise.all([
        getContainer(chainId),
        getActiveRun(chainId),
        getHouseholdMembers(),
      ]);

      if (!chainData) {
        setError("Chain not found");
        return;
      }

      setChain(chainData);
      setHouseholdMembers(membersData.members);
      setCurrentUserId(membersData.currentUserId);

      if (activeRun) {
        // Resume existing run
        setRun(activeRun);
      } else {
        // Check if we need to show context modal
        const needsDuration = hasConditionType(chainData.items, "duration_min");
        const needsTag = hasConditionType(chainData.items, "tag");

        if (needsDuration || needsTag) {
          setShowContextModal(true);
        } else {
          // Start run immediately with just time/weather
          const newRun = await startRun(chainId, {});
          const runWithItems = await getActiveRun(chainId);
          setRun(runWithItems);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chain");
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartWithContext = async (context: {
    duration_input?: number;
    tag?: Tag;
    weather?: WeatherCondition;
  }) => {
    setShowContextModal(false);
    setLoading(true);

    try {
      await startRun(chainId, context);
      const runWithItems = await getActiveRun(chainId);
      setRun(runWithItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    const activeRun = await getActiveRun(chainId);
    setRun(activeRun);
  }, [chainId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !chain) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-950">
            <p className="text-red-600 dark:text-red-400">{error || "Chain not found"}</p>
            <Link href="/chains" className="mt-2 inline-block text-sm underline">
              Back to Chains
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
            href={`/chains/${chainId}`}
            className="mb-2 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
          >
            ← Back to Chain
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{chain.name}</h2>
              {chain.trigger_description && (
                <p className="mt-1 text-sm italic text-zinc-500">
                  {chain.trigger_description}
                </p>
              )}
            </div>
            {run?.completed_at && (
              <Button
                variant="outline"
                onClick={async () => {
                  setLoading(true);
                  const newRun = await startRun(chainId, run.context_snapshot || {});
                  const runWithItems = await getActiveRun(chainId);
                  setRun(runWithItems);
                  setLoading(false);
                }}
              >
                Run Again
              </Button>
            )}
          </div>
        </div>

        {/* Context Info */}
        {run?.context_snapshot && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {run.context_snapshot.time_of_day && (
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                🕐 {run.context_snapshot.time_of_day}
              </span>
            )}
            {run.context_snapshot.weather && (
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                ☀️ {run.context_snapshot.weather}
              </span>
            )}
            {run.context_snapshot.duration_input && (
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                ⏱️ {run.context_snapshot.duration_input >= 60
                  ? `${Math.round(run.context_snapshot.duration_input / 60)}h`
                  : `${run.context_snapshot.duration_input}m`}
              </span>
            )}
            {run.context_snapshot.tag && (
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                {run.context_snapshot.tag === "outdoor" ? "🏞️" : "🏠"} {run.context_snapshot.tag}
              </span>
            )}
          </div>
        )}

        {/* Run Checklist */}
        {run && (
          <RunChecklist
            run={run}
            containerType="chain"
            containerName={chain.name}
            householdMembers={householdMembers}
            currentUserId={currentUserId}
            onUpdate={handleRefresh}
          />
        )}
      </div>

      {/* Context Modal */}
      {chain && (
        <RunContextModal
          open={showContextModal}
          onClose={() => {
            setShowContextModal(false);
            router.push(`/chains/${chainId}`);
          }}
          onStart={handleStartWithContext}
          needsDuration={hasConditionType(chain.items, "duration_min")}
          needsTag={hasConditionType(chain.items, "tag")}
          containerName={chain.name}
        />
      )}
    </div>
  );
}
