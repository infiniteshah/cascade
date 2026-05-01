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

  const { data: containers, error } = await supabase
    .from("containers")
    .select(`
      *,
      owner:profiles!owner_id(display_name, avatar_url),
      items:container_items(count),
      runs:container_runs(started_at)
    `)
    .eq("household_id", householdId)
    .eq("type", type)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (containers || []).map((c: any) => ({
    ...c,
    item_count: c.items?.[0]?.count || 0,
    last_run_at: c.runs?.[0]?.started_at || null,
    owner: c.owner,
  }));
}

// Get a single container with its items
export async function getContainer(id: string): Promise<ContainerWithItems | null> {
  const supabase = await createClient();

  const { data: container, error } = await supabase
    .from("containers")
    .select(`
      *,
      items:container_items(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  // Sort items by position
  if (container.items) {
    container.items.sort((a: ContainerItem, b: ContainerItem) => a.position - b.position);
  }

  return container as ContainerWithItems;
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

// Seed default chains for a household
export async function seedDefaultChains(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const householdId = await getHouseholdId();

  // Check if chains already exist
  const { count } = await supabase
    .from("containers")
    .select("*", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("type", "chain");

  if (count && count > 0) {
    // Already seeded
    return;
  }

  // Call the seed function
  const { error } = await supabase.rpc("seed_default_chains", {
    p_household_id: householdId,
    p_owner_id: user.id,
  });

  if (error) throw error;

  revalidatePath("/chains");
}
