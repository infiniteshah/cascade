export type ContainerType = 'chain' | 'list' | 'meal_plan';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type WeatherCondition = 'rain' | 'snow' | 'below_freezing' | 'above_25c' | 'clear';
export type Tag = 'outdoor' | 'indoor';

export interface ItemConditions {
  time_of_day?: TimeOfDay;
  duration_min?: number;
  weather?: WeatherCondition;
  tag?: Tag;
}

export interface Container {
  id: string;
  household_id: string;
  owner_id: string;
  type: ContainerType;
  name: string;
  description: string | null;
  is_shared: boolean;
  trigger_description: string | null;
  schedule_cron: string | null;
  weather_trigger: string | null;
  meal_plan_week_start: string | null;
  meal_plan_status: 'draft' | 'approved' | 'shopping' | 'done' | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContainerItem {
  id: string;
  container_id: string;
  position: number;
  text: string;
  conditions: ItemConditions | null;
  parent_container_id: string | null;
  created_at: string;
}

export interface ContainerRun {
  id: string;
  container_id: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  context_snapshot: {
    time_of_day?: TimeOfDay;
    weather?: WeatherCondition;
    duration_input?: number;
    tag?: Tag;
  } | null;
}

export interface RunItem {
  id: string;
  run_id: string;
  container_item_id: string;
  is_visible: boolean;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  manual_override: boolean;
}

// Extended types with relations
export interface ContainerWithItems extends Container {
  items: ContainerItem[];
}

export interface ContainerWithMeta extends Container {
  item_count: number;
  last_run_at: string | null;
  owner?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Form types for creating/editing
export interface CreateContainerInput {
  type: ContainerType;
  name: string;
  description?: string;
  is_shared?: boolean;
  trigger_description?: string;
  items: {
    text: string;
    conditions?: ItemConditions;
  }[];
}

export interface UpdateContainerInput {
  name?: string;
  description?: string;
  is_shared?: boolean;
  trigger_description?: string;
}

export interface CreateItemInput {
  text: string;
  position: number;
  conditions?: ItemConditions;
}
