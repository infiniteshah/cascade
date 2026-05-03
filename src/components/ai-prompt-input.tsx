"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AIPromptInputProps {
  type: "chain" | "list";
  onGenerate: (prompt: string) => Promise<void>;
  onSkip: () => void;
  isLoading: boolean;
  error: string | null;
}

export function AIPromptInput({
  type,
  onGenerate,
  onSkip,
  isLoading,
  error,
}: AIPromptInputProps) {
  const [prompt, setPrompt] = useState("");

  const placeholder =
    type === "chain"
      ? "Describe your chain, e.g., 'Going out with the baby - need to pack food, water, diapers, weather-appropriate clothes...'"
      : "Describe your list, e.g., 'Weekend errands - grocery shopping, pick up dry cleaning, return library books...'";

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    await onGenerate(prompt.trim());
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">
          Describe your {type}
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Tell me what you want to accomplish and I'll create a draft for you to review.
        </p>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={isLoading}
        className="resize-none"
      />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating...
            </>
          ) : (
            "Generate Draft"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onSkip}
          disabled={isLoading}
        >
          Create Manually
        </Button>
      </div>

      <p className="text-center text-xs text-zinc-400">
        You can edit everything after generation
      </p>
    </div>
  );
}
