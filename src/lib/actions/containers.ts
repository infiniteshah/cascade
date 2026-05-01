"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Container,
  ContainerItem,
  ContainerWithItems,
  ContainerWithMeta,
  CreateContainerInput,
  UpdateContainerInput,
  ContainerType,
  ItemConditions,
} from "@/lib/types/containers";

// Get user's household ID
async function getHouseholdId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) throw new Error("No household");

  return profile.household_id;
}

// Get all containers of a specific type
export async function getContainers(type: ContainerType): Promise<ContainerWithMeta[]> {
  const supabase = await createClient();
  const householdId = await getHouseholdId();

  // First get containers
  const { data: containers, error } = await supabase
    .from("containers")
    .select(`
      *,
      owner:profiles!owner_id(display_name, avatar_url)
    `)
    .eq("household_id", householdId)
    .eq("type", type)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  // Get item counts and last run separately to avoid ambiguous relationship
  const containerIds = (containers || []).map(c => c.id);

  if (containerIds.length === 0) {
    return [];
  }

  // Get item counts
  const { data: itemCounts } = await supabase
    .from("container_items")
    .select("container_id")
    .in("container_id", containerIds);

  // Get last runs
  const { data: lastRuns } = await supabase
    .from("container_runs")
    .select("container_id, started_at")
    .in("container_id", containerIds)
    .order("started_at", { ascending: false });

  // Build lookup maps
  const countMap = new Map<string, number>();
  (itemCounts || []).forEach(item => {
    countMap.set(item.container_id, (countMap.get(item.container_id) || 0) + 1);
  });

  const lastRunMap = new Map<string, string>();
  (lastRuns || []).forEach(run => {
    if (!lastRunMap.has(run.container_id)) {
      lastRunMap.set(run.container_id, run.started_at);
    }
  });

  return (containers || []).map((c: any) => ({
    ...c,
    item_count: countMap.get(c.id) || 0,
    last_run_at: lastRunMap.get(c.id) || null,
    owner: c.owner,
  }));
}

// Get a single container with its items
export async function getContainer(id: string): Promise<ContainerWithItems | null> {
  const supabase = await createClient();

  // Get container
  const { data: container, error } = await supabase
    .from("containers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  // Get items separately to avoid ambiguous relationship
  const { data: items } = await supabase
    .from("container_items")
    .select("*")
    .eq("container_id", id)
    .order("position", { ascending: true });

  return {
    ...container,
    items: items || [],
  } as ContainerWithItems;
}

// Create a new container with items
export async function createContainer(input: CreateContainerInput): Promise<Container> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const householdId = await getHouseholdId();

  // Insert the container
  const { data: container, error: containerError } = await supabase
    .from("containers")
    .insert({
      household_id: householdId,
      owner_id: user.id,
      type: input.type,
      name: input.name,
      description: input.description || null,
      is_shared: input.is_shared ?? false,
      trigger_description: input.trigger_description || null,
    })
    .select()
    .single();

  if (containerError) throw containerError;

  // Insert items
  if (input.items.length > 0) {
    const items = input.items.map((item, index) => ({
      container_id: container.id,
      position: index + 1,
      text: item.text,
      conditions: item.conditions || null,
    }));

    const { error: itemsError } = await supabase
      .from("container_items")
      .insert(items);

    if (itemsError) throw itemsError;
  }

  revalidatePath(`/${input.type}s`);
  return container;
}

// Update a container
export async function updateContainer(
  id: string,
  input: UpdateContainerInput
): Promise<Container> {
  const supabase = await createClient();

  const { data: container, error } = await supabase
    .from("containers")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/${container.type}s`);
  revalidatePath(`/${container.type}s/${id}`);
  return container;
}

// Soft delete a container
export async function archiveContainer(id: string): Promise<void> {
  const supabase = await createClient();

  const { data: container, error } = await supabase
    .from("containers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .single();

  if (error) throw error;

  revalidatePath(`/${container.type}s`);
}

// Permanently delete a container
export async function deleteContainer(id: string): Promise<void> {
  const supabase = await createClient();

  const { data: container } = await supabase
    .from("containers")
    .select("type")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("containers")
    .delete()
    .eq("id", id);

  if (error) throw error;

  if (container) {
    revalidatePath(`/${container.type}s`);
  }
}

// Add an item to a container
export async function addContainerItem(
  containerId: string,
  text: string,
  conditions?: ItemConditions
): Promise<ContainerItem> {
  const supabase = await createClient();

  // Get the current max position
  const { data: maxItem } = await supabase
    .from("container_items")
    .select("position")
    .eq("container_id", containerId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const newPosition = (maxItem?.position || 0) + 1;

  const { data: item, error } = await supabase
    .from("container_items")
    .insert({
      container_id: containerId,
      position: newPosition,
      text,
      conditions: conditions || null,
    })
    .select()
    .single();

  if (error) throw error;

  return item;
}

// Update an item
export async function updateContainerItem(
  itemId: string,
  text: string,
  conditions?: ItemConditions | null
): Promise<ContainerItem> {
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("container_items")
    .update({
      text,
      conditions: conditions ?? null,
    })
    .eq("id", itemId)
    .select()
    .single();

  if (error) throw error;

  return item;
}

// Delete an item
export async function deleteContainerItem(itemId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("container_items")
    .delete()
    .eq("id", itemId);

  if (error) throw error;
}

// Reorder items
export async function reorderContainerItems(
  containerId: string,
  itemIds: string[]
): Promise<void> {
  const supabase = await createClient();

  // Update positions for each item
  const updates = itemIds.map((id, index) =>
    supabase
      .from("container_items")
      .update({ position: index + 1 })
      .eq("id", id)
  );

  await Promise.all(updates);

  // Update container timestamp
  await supabase
    .from("containers")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", containerId);
}

// Seed default chains for a household (called during data fetch, no revalidation)
export async function seedDefaultChains(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  let householdId: string;
  try {
    householdId = await getHouseholdId();
  } catch {
    return false;
  }

  // Check if chains already exist
  const { count } = await supabase
    .from("containers")
    .select("*", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("type", "chain");

  if (count && count > 0) {
    // Already seeded
    return false;
  }

  // Call the seed function
  const { error } = await supabase.rpc("seed_default_chains", {
    p_household_id: householdId,
    p_owner_id: user.id,
  });

  if (error) {
    console.error("Failed to seed default chains:", error);
    return false;
  }

  return true; // Seeded successfully
}
