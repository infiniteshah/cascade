"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { durationOptions, tagOptions } from "@/lib/utils/conditions";
import type { Tag, WeatherCondition } from "@/lib/types/containers";

interface RunContextModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (context: { duration_input?: number; tag?: Tag; weather?: WeatherCondition }) => void;
  needsDuration: boolean;
  needsTag: boolean;
  containerName: string;
}

export function RunContextModal({
  open,
  onClose,
  onStart,
  needsDuration,
  needsTag,
  containerName,
}: RunContextModalProps) {
  const [duration, setDuration] = useState<number | undefined>();
  const [tag, setTag] = useState<Tag | undefined>();
  const [loading, setLoading] = useState(false);

  // Mock weather for now - will integrate OpenWeather in later phase
  const mockWeather: WeatherCondition = "clear";

  const handleStart = async () => {
    setLoading(true);
    await onStart({
      duration_input: duration,
      tag,
      weather: mockWeather,
    });
    setLoading(false);
  };

  const canStart = (!needsDuration || duration !== undefined) && (!needsTag || tag !== undefined);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start: {containerName}</DialogTitle>
          <DialogDescription>
            {needsDuration || needsTag
              ? "Answer a few quick questions to customize your run"
              : "Ready to start this chain?"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Duration Question */}
          {needsDuration && (
            <div>
              <p className="mb-3 text-sm font-medium">How long will you be out?</p>
              <div className="grid grid-cols-2 gap-2">
                {durationOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      duration === opt.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-zinc-500">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tag Question */}
          {needsTag && (
            <div>
              <p className="mb-3 text-sm font-medium">What type of outing?</p>
              <div className="flex gap-2">
                {tagOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTag(opt.value)}
                    className={`flex-1 rounded-lg border p-3 text-center transition-colors ${
                      tag === opt.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    <p className="text-2xl">{opt.icon}</p>
                    <p className="mt-1 text-sm font-medium">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Weather Info (read-only for now) */}
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500">Current conditions</p>
            <p className="mt-1 text-sm">
              ☀️ Clear skies • {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={!canStart || loading} className="flex-1">
            {loading ? "Starting..." : "Start Run"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
