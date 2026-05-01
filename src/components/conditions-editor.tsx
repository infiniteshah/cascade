"use client";

import type { ItemConditions, TimeOfDay, WeatherCondition, Tag } from "@/lib/types/containers";

interface ConditionsEditorProps {
  conditions: ItemConditions;
  onChange: (conditions: ItemConditions) => void;
}

const timeOptions: { value: TimeOfDay; label: string; icon: string }[] = [
  { value: "morning", label: "Morning", icon: "🌅" },
  { value: "afternoon", label: "Afternoon", icon: "☀️" },
  { value: "evening", label: "Evening", icon: "🌆" },
  { value: "night", label: "Night", icon: "🌙" },
];

const weatherOptions: { value: WeatherCondition; label: string; icon: string }[] = [
  { value: "rain", label: "Rain", icon: "🌧️" },
  { value: "snow", label: "Snow", icon: "❄️" },
  { value: "below_freezing", label: "Cold", icon: "🥶" },
  { value: "above_25c", label: "Hot", icon: "🥵" },
  { value: "clear", label: "Clear", icon: "☀️" },
];

const tagOptions: { value: Tag; label: string; icon: string }[] = [
  { value: "outdoor", label: "Outdoor", icon: "🏞️" },
  { value: "indoor", label: "Indoor", icon: "🏠" },
];

const durationOptions: { value: number; label: string }[] = [
  { value: 60, label: "1hr+" },
  { value: 180, label: "3hr+" },
  { value: 480, label: "Overnight" },
];

export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps) {
  const toggleTimeOfDay = (value: TimeOfDay) => {
    onChange({
      ...conditions,
      time_of_day: conditions.time_of_day === value ? undefined : value,
    });
  };

  const toggleWeather = (value: WeatherCondition) => {
    onChange({
      ...conditions,
      weather: conditions.weather === value ? undefined : value,
    });
  };

  const toggleTag = (value: Tag) => {
    onChange({
      ...conditions,
      tag: conditions.tag === value ? undefined : value,
    });
  };

  const toggleDuration = (value: number) => {
    onChange({
      ...conditions,
      duration_min: conditions.duration_min === value ? undefined : value,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-zinc-500">Conditions (optional)</p>

      {/* Time of Day */}
      <div>
        <p className="mb-1 text-xs text-zinc-400">Time of day</p>
        <div className="flex flex-wrap gap-1">
          {timeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleTimeOfDay(opt.value)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                conditions.time_of_day === opt.value
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Weather */}
      <div>
        <p className="mb-1 text-xs text-zinc-400">Weather</p>
        <div className="flex flex-wrap gap-1">
          {weatherOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleWeather(opt.value)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                conditions.weather === opt.value
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tag */}
      <div>
        <p className="mb-1 text-xs text-zinc-400">Location</p>
        <div className="flex flex-wrap gap-1">
          {tagOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleTag(opt.value)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                conditions.tag === opt.value
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <p className="mb-1 text-xs text-zinc-400">Trip duration</p>
        <div className="flex flex-wrap gap-1">
          {durationOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleDuration(opt.value)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                conditions.duration_min === opt.value
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>⏱️</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
