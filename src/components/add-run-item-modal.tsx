"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContainerType, ItemConditions } from "@/lib/types/containers";

interface AddRunItemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: { text: string; position: number; conditions?: ItemConditions }) => Promise<void>;
  containerType: ContainerType;
  containerName: string;
  existingItems: { text: string; position: number }[];
}

export function AddRunItemModal({
  open,
  onClose,
  onAdd,
  containerType,
  containerName,
  existingItems,
}: AddRunItemModalProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (useAI) {
        // Use AI to generate item with position
        const response = await fetch("/api/generate/mid-run-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: input.trim(),
            containerType,
            containerName,
            existingItems,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to generate item");
        }

        const { item } = await response.json();
        await onAdd({
          text: item.text,
          position: item.insert_after_position + 1, // Convert to 0-indexed position
          conditions: item.conditions,
        });
      } else {
        // Add item at the end manually
        await onAdd({
          text: input.trim(),
          position: existingItems.length,
        });
      }

      setInput("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
          <DialogDescription>
            {useAI
              ? "Describe what you need to add and I'll place it in the right spot."
              : "Type the item text to add it at the end."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              useAI
                ? "e.g., Don't forget to grab the umbrella"
                : "Item text..."
            }
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
            disabled={loading}
            autoFocus
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use_ai"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
              disabled={loading}
            />
            <label htmlFor="use_ai" className="text-sm text-zinc-600 dark:text-zinc-400">
              Use AI to position item
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!input.trim() || loading} className="flex-1">
            {loading ? "Adding..." : "Add Item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
