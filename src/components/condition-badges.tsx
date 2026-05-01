import type { ItemConditions } from "@/lib/types/containers";

interface ConditionBadgesProps {
  conditions: ItemConditions;
  size?: "sm" | "md";
}

const conditionLabels: Record<string, Record<string, string>> = {
  time_of_day: {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
  },
  weather: {
    rain: "Rain",
    snow: "Snow",
    below_freezing: "Cold (<0°C)",
    above_25c: "Hot (>25°C)",
    clear: "Clear",
  },
  tag: {
    outdoor: "Outdoor",
    indoor: "Indoor",
  },
};

const conditionIcons: Record<string, string> = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌆",
  night: "🌙",
  rain: "🌧️",
  snow: "❄️",
  below_freezing: "🥶",
  above_25c: "🥵",
  clear: "☀️",
  outdoor: "🏞️",
  indoor: "🏠",
};

export function ConditionBadges({ conditions, size = "sm" }: ConditionBadgesProps) {
  const badges: { label: string; icon: string }[] = [];

  if (conditions.time_of_day) {
    badges.push({
      label: conditionLabels.time_of_day[conditions.time_of_day],
      icon: conditionIcons[conditions.time_of_day],
    });
  }

  if (conditions.weather) {
    badges.push({
      label: conditionLabels.weather[conditions.weather],
      icon: conditionIcons[conditions.weather],
    });
  }

  if (conditions.tag) {
    badges.push({
      label: conditionLabels.tag[conditions.tag],
      icon: conditionIcons[conditions.tag],
    });
  }

  if (conditions.duration_min) {
    const hours = conditions.duration_min / 60;
    const label = hours >= 1 ? `${hours}h+ trip` : `${conditions.duration_min}m+ trip`;
    badges.push({
      label,
      icon: "⏱️",
    });
  }

  if (badges.length === 0) return null;

  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge, index) => (
        <span
          key={index}
          className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ${sizeClasses}`}
        >
          <span>{badge.icon}</span>
          <span>{badge.label}</span>
        </span>
      ))}
    </div>
  );
}
