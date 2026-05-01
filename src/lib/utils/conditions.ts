import type { ItemConditions, TimeOfDay, WeatherCondition, Tag } from "@/lib/types/containers";

export interface RunContext {
  time_of_day: TimeOfDay;
  weather?: WeatherCondition;
  duration_input?: number; // minutes
  tag?: Tag;
}

/**
 * Get current time of day
 */
export function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * Evaluate whether an item should be visible given the current context.
 * All conditions must match (AND logic). Empty conditions = always visible.
 */
export function evaluateConditions(
  conditions: ItemConditions | null,
  context: RunContext
): boolean {
  // No conditions = always visible
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }

  // Check time_of_day
  if (conditions.time_of_day && conditions.time_of_day !== context.time_of_day) {
    return false;
  }

  // Check weather
  if (conditions.weather && conditions.weather !== context.weather) {
    return false;
  }

  // Check duration_min (show only if trip duration >= condition value)
  if (conditions.duration_min) {
    if (!context.duration_input || context.duration_input < conditions.duration_min) {
      return false;
    }
  }

  // Check tag
  if (conditions.tag && conditions.tag !== context.tag) {
    return false;
  }

  return true;
}

/**
 * Check if any items in the list have a specific condition type
 */
export function hasConditionType(
  items: { conditions: ItemConditions | null }[],
  conditionType: keyof ItemConditions
): boolean {
  return items.some(
    (item) => item.conditions && item.conditions[conditionType] !== undefined
  );
}

/**
 * Duration options for the run context modal
 */
export const durationOptions = [
  { value: 30, label: "< 1 hour", description: "Quick trip" },
  { value: 90, label: "1-3 hours", description: "Medium outing" },
  { value: 240, label: "3+ hours", description: "Half day" },
  { value: 720, label: "Overnight", description: "Extended trip" },
];

/**
 * Tag options for the run context modal
 */
export const tagOptions: { value: Tag; label: string; icon: string }[] = [
  { value: "outdoor", label: "Outdoor", icon: "🏞️" },
  { value: "indoor", label: "Indoor", icon: "🏠" },
];
