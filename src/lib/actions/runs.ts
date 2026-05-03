"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { evaluateConditions, getCurrentTimeOfDay, type RunContext } from "@/lib/utils/conditions";
import type { ContainerRun, RunItem, ContainerItem } from "@/lib/types/containers";

export interface RunWithItems extends ContainerRun {
  items: (RunItem & { container_item: ContainerItem })[];
}

/**
 * Start a new run for a container
 */
export async function startRun(
  containerId: string,
  context?: Partial<RunContext>
): Promise<ContainerRun> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Get container and its items
  const { data: container } = await supabase
    .from("containers")
    .select("type")
    .eq("id", containerId)
    .single();

  if (!container) throw new Error("Container not found");

  const { data: items } = await supabase
    .from("container_items")
    .select("*")
    .eq("container_id", containerId)
    .order("position", { ascending: true });

  // Build full context
  const fullContext: RunContext = {
    time_of_day: getCurrentTimeOfDay(),
    weather: context?.weather,
    duration_input: context?.duration_input,
    tag: context?.tag,
  };

  // Create the run
  const { data: run, error: runError } = await supabase
    .from("container_runs")
    .insert({
      container_id: containerId,
      started_by: user.id,
      context_snapshot: container.type === "chain" ? fullContext : null,
    })
    .select()
    .single();

  if (runError) throw runError;

  // Create run_items with visibility computed
  const runItems = (items || []).map((item) => ({
    run_id: run.id,
    container_item_id: item.id,
    is_visible: container.type === "chain"
      ? evaluateConditions(item.conditions, fullContext)
      : true, // Lists always visible
    is_checked: false,
  }));

  if (runItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("run_items")
      .insert(runItems);

    if (itemsError) throw itemsError;
  }

  return run;
}

/**
 * Get an active or specific run with its items
 */
export async function getRun(runId: string): Promise<RunWithItems | null> {
  const supabase = await createClient();

  const { data: run, error } = await supabase
    .from("container_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (error || !run) return null;

  // Get run items with their container items
  const { data: runItems } = await supabase
    .from("run_items")
    .select("*")
    .eq("run_id", runId);

  // Get container items for these run items
  const containerItemIds = (runItems || []).map(ri => ri.container_item_id);

  const { data: containerItems } = await supabase
    .from("container_items")
    .select("*")
    .in("id", containerItemIds);

  // Create a map for quick lookup
  const containerItemMap = new Map(
    (containerItems || []).map(ci => [ci.id, ci])
  );

  // Combine run items with their container items and sort by position
  const itemsWithDetails = (runItems || [])
    .map(ri => ({
      ...ri,
      container_item: containerItemMap.get(ri.container_item_id)!,
    }))
    .filter(ri => ri.container_item) // Filter out any orphaned items
    .sort((a, b) => a.container_item.position - b.container_item.position);

  return {
    ...run,
    items: itemsWithDetails,
  };
}

/**
 * Get the most recent active run for a container
 */
export async function getActiveRun(containerId: string): Promise<RunWithItems | null> {
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("container_runs")
    .select("*")
    .eq("container_id", containerId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!run) return null;

  return getRun(run.id);
}

/**
 * Check/uncheck a run item
 */
export async function toggleRunItem(
  runItemId: string,
  isChecked: boolean
): Promise<RunItem> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: item, error } = await supabase
    .from("run_items")
    .update({
      is_checked: isChecked,
      checked_by: isChecked ? user.id : null,
      checked_at: isChecked ? new Date().toISOString() : null,
    })
    .eq("id", runItemId)
    .select()
    .single();

  if (error) throw error;

  // Check if all visible items are now checked
  const { data: runItems } = await supabase
    .from("run_items")
    .select("is_visible, is_checked")
    .eq("run_id", item.run_id);

  const allVisibleChecked = (runItems || [])
    .filter(ri => ri.is_visible)
    .every(ri => ri.is_checked);

  // Auto-complete the run if all visible items are checked
  if (allVisibleChecked) {
    await supabase
      .from("container_runs")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", item.run_id);
  }

  return item;
}

/**
 * Toggle visibility override for a hidden item
 */
export async function overrideItemVisibility(runItemId: string): Promise<RunItem> {
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("run_items")
    .update({
      is_visible: true,
      manual_override: true,
    })
    .eq("id", runItemId)
    .select()
    .single();

  if (error) throw error;

  return item;
}

/**
 * Complete a run manually
 */
export async function completeRun(runId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("container_runs")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", runId);

  if (error) throw error;
}

/**
 * Get run history for a container
 */
export async function getRunHistory(
  containerId: string,
  limit = 10
): Promise<ContainerRun[]> {
  const supabase = await createClient();

  const { data: runs, error } = await supabase
    .from("container_runs")
    .select("*")
    .eq("container_id", containerId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return runs || [];
}

/**
 * Add an item mid-run
 * Creates both a container_item and a run_item
 */
export async function addRunItem(
  runId: string,
  item: {
    text: string;
    position: number;
    conditions?: import("@/lib/types/containers").ItemConditions;
  }
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Get the run to find the container
  const { data: run } = await supabase
    .from("container_runs")
    .select("container_id, context_snapshot")
    .eq("id", runId)
    .single();

  if (!run) throw new Error("Run not found");

  // Get container type
  const { data: container } = await supabase
    .from("containers")
    .select("type")
    .eq("id", run.container_id)
    .single();

  if (!container) throw new Error("Container not found");

  // Get existing items to determine positions
  const { data: existingItems } = await supabase
    .from("container_items")
    .select("id, position")
    .eq("container_id", run.container_id)
    .order("position", { ascending: true });

  const items = existingItems || [];
  const insertPosition = item.position;

  // Shift positions of items after the insert point
  for (const existingItem of items) {
    if (existingItem.position >= insertPosition) {
      await supabase
        .from("container_items")
        .update({ position: existingItem.position + 1 })
        .eq("id", existingItem.id);
    }
  }

  // Create the container item
  const { data: newItem, error: itemError } = await supabase
    .from("container_items")
    .insert({
      container_id: run.container_id,
      text: item.text,
      position: insertPosition,
      conditions: container.type === "chain" && item.conditions
        ? item.conditions
        : null,
    })
    .select()
    .single();

  if (itemError) throw itemError;

  // Evaluate visibility for chains
  const isVisible = container.type === "chain" && run.context_snapshot
    ? evaluateConditions(
        item.conditions ?? null,
        run.context_snapshot as RunContext
      )
    : true;

  // Create the run item
  const { error: runItemError } = await supabase
    .from("run_items")
    .insert({
      run_id: runId,
      container_item_id: newItem.id,
      is_visible: isVisible,
      is_checked: false,
    });

  if (runItemError) throw runItemError;
}
