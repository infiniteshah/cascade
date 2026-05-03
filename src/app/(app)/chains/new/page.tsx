"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConditionsEditor } from "@/components/conditions-editor";
import { AIPromptInput } from "@/components/ai-prompt-input";
import { createContainer } from "@/lib/actions/containers";
import type { ItemConditions } from "@/lib/types/containers";

interface DraftItem {
  id: string;
  text: string;
  conditions: ItemConditions;
}

type Mode = "ai-prompt" | "editor";

export default function NewChainPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai-prompt");

  // AI prompt state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Editor state
  const [name, setName] = useState("");
  const [triggerDescription, setTriggerDescription] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const response = await fetch("/api/generate/chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate chain");
      }

      const { chain } = await response.json();

      // Populate editor with generated data
      setName(chain.name);
      setTriggerDescription(chain.trigger_description || "");
      setItems(
        chain.items.map((item: { text: string; conditions?: ItemConditions }) => ({
          id: crypto.randomUUID(),
          text: item.text,
          conditions: item.conditions || {},
        }))
      );
      setMode("editor");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate chain");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    const newItem: DraftItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      conditions: {},
    };
    setItems([...items, newItem]);
    setNewItemText("");
  };

  const handleUpdateItem = (itemId: string, text: string, conditions: ItemConditions) => {
    setItems(items.map((i) => (i.id === itemId ? { ...i, text, conditions } : i)));
    setEditingItemId(null);
  };

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a chain name");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const chain = await createContainer({
        type: "chain",
        name: name.trim(),
        trigger_description: triggerDescription.trim() || undefined,
        is_shared: isShared,
        items: items.map((i) => ({
          text: i.text,
          conditions: Object.keys(i.conditions).length > 0 ? i.conditions : undefined,
        })),
      });
      router.push(`/chains/${chain.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chain");
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/chains"
          className="mb-4 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← Back to Chains
        </Link>
        <h2 className="mb-6 text-2xl font-bold">New Chain</h2>

        {mode === "ai-prompt" ? (
          <Card>
            <CardContent className="p-6">
              <AIPromptInput
                type="chain"
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
              {/* Chain Details */}
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Name *</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Going Out With Kid"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Trigger</label>
                    <Input
                      value={triggerDescription}
                      onChange={(e) => setTriggerDescription(e.target.value)}
                      placeholder="What triggers this chain? e.g., About to leave the house"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      Describe the real-world cue that prompts you to run this chain
                    </p>
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
                        {editingItemId === item.id ? (
                          <ItemEditor
                            item={item}
                            onSave={(text, conditions) => handleUpdateItem(item.id, text, conditions)}
                            onCancel={() => setEditingItemId(null)}
                          />
                        ) : (
                          <div className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium dark:bg-zinc-800">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm">{item.text}</p>
                              {Object.keys(item.conditions).length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {Object.entries(item.conditions).map(([key, value]) => (
                                    <span
                                      key={key}
                                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                    >
                                      {key}: {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingItemId(item.id)}
                                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="rounded p-1 text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )}
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
                  {saving ? "Creating..." : "Create Chain"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Inline item editor
function ItemEditor({
  item,
  onSave,
  onCancel,
}: {
  item: DraftItem;
  onSave: (text: string, conditions: ItemConditions) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [conditions, setConditions] = useState<ItemConditions>(item.conditions);

  return (
    <div className="space-y-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Item text"
        autoFocus
      />
      <ConditionsEditor conditions={conditions} onChange={setConditions} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(text, conditions)}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
