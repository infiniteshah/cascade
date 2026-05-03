"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AIPromptInput } from "@/components/ai-prompt-input";
import { createContainer } from "@/lib/actions/containers";

interface DraftItem {
  id: string;
  text: string;
}

type Mode = "ai-prompt" | "editor";

export default function NewListPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai-prompt");

  // AI prompt state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Editor state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const response = await fetch("/api/generate/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate list");
      }

      const { list } = await response.json();

      // Populate editor with generated data
      setName(list.name);
      setItems(
        list.items.map((item: { text: string }) => ({
          id: crypto.randomUUID(),
          text: item.text,
        }))
      );
      setMode("editor");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate list");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    const newItem: DraftItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
    };
    setItems([...items, newItem]);
    setNewItemText("");
  };

  const handleUpdateItem = (itemId: string, text: string) => {
    setItems(items.map((i) => (i.id === itemId ? { ...i, text } : i)));
  };

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a list name");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const list = await createContainer({
        type: "list",
        name: name.trim(),
        description: description.trim() || undefined,
        is_shared: isShared,
        items: items.map((i) => ({ text: i.text })),
      });
      router.push(`/lists/${list.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create list");
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/lists"
          className="mb-4 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← Back to Lists
        </Link>
        <h2 className="mb-6 text-2xl font-bold">New List</h2>

        {mode === "ai-prompt" ? (
          <Card>
            <CardContent className="p-6">
              <AIPromptInput
                type="list"
                onGenerate={handleGenerate}
                onSkip={() => setMode("editor")}
                isLoading={isGenerating}
                error={generateError}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* List Details */}
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Name *</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Day Off Errands"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Description</label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_shared"
                      checked={isShared}
                      onChange={(e) => setIsShared(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    <label htmlFor="is_shared" className="text-sm">
                      Share with household
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <div>
                <h3 className="mb-3 font-semibold">Items</h3>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <Card key={item.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium dark:bg-zinc-800">
                            {index + 1}
                          </span>
                          <Input
                            value={item.text}
                            onChange={(e) => handleUpdateItem(item.id, e.target.value)}
                            className="flex-1"
                          />
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="rounded p-1 text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30"
                          >
                            🗑️
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Add new item */}
                <div className="mt-4 flex gap-2">
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="Add an item..."
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                  />
                  <Button variant="outline" onClick={handleAddItem} disabled={!newItemText.trim()}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Save */}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? "Creating..." : "Create List"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
