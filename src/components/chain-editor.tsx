"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConditionsEditor } from "@/components/conditions-editor";
import {
  updateContainer,
  addContainerItem,
  updateContainerItem,
  deleteContainerItem,
  reorderContainerItems,
  archiveContainer,
} from "@/lib/actions/containers";
import type { ContainerWithItems, ContainerItem, ItemConditions } from "@/lib/types/containers";

interface ChainEditorProps {
  chain: ContainerWithItems;
}

export function ChainEditor({ chain }: ChainEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(chain.name);
  const [triggerDescription, setTriggerDescription] = useState(chain.trigger_description || "");
  const [isShared, setIsShared] = useState(chain.is_shared);
  const [items, setItems] = useState<ContainerItem[]>(chain.items);
  const [newItemText, setNewItemText] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await updateContainer(chain.id, {
        name,
        trigger_description: triggerDescription || undefined,
        is_shared: isShared,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    setSaving(true);
    try {
      const item = await addContainerItem(chain.id, newItemText.trim());
      setItems([...items, item]);
      setNewItemText("");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async (itemId: string, text: string, conditions?: ItemConditions | null) => {
    setSaving(true);
    try {
      const updated = await updateContainerItem(itemId, text, conditions);
      setItems(items.map((i) => (i.id === itemId ? updated : i)));
      setEditingItemId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this item?")) return;
    setSaving(true);
    try {
      await deleteContainerItem(itemId);
      setItems(items.filter((i) => i.id !== itemId));
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setItems(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null) {
      setSaving(true);
      try {
        await reorderContainerItems(chain.id, items.map((i) => i.id));
      } finally {
        setSaving(false);
      }
    }
    setDraggedIndex(null);
  };

  const handleArchive = async () => {
    if (!confirm("Archive this chain? You can recover it within 30 days.")) return;
    await archiveContainer(chain.id);
    router.push("/chains");
  };

  return (
    <div className="space-y-6">
      {/* Chain Details */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chain name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Trigger</label>
            <Input
              value={triggerDescription}
              onChange={(e) => setTriggerDescription(e.target.value)}
              placeholder="What triggers this chain? e.g., Detergent at base of stairs"
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
          <Button onClick={handleSaveDetails} disabled={saving}>
            {saving ? "Saving..." : "Save Details"}
          </Button>
        </CardContent>
      </Card>

      {/* Items */}
      <div>
        <h3 className="mb-3 font-semibold">Items</h3>
        <div className="space-y-2">
          {items.map((item, index) => (
            <Card
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`cursor-move ${draggedIndex === index ? "opacity-50" : ""}`}
            >
              <CardContent className="p-3">
                {editingItemId === item.id ? (
                  <ItemEditor
                    item={item}
                    onSave={(text, conditions) => handleUpdateItem(item.id, text, conditions)}
                    onCancel={() => setEditingItemId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-xs dark:bg-zinc-800">
                      ⋮⋮
                    </span>
                    <div className="flex-1">
                      <p className="text-sm">{item.text}</p>
                      {item.conditions && Object.keys(item.conditions).length > 0 && (
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
            placeholder="Add a new item..."
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
          <Button onClick={handleAddItem} disabled={saving || !newItemText.trim()}>
            Add
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardContent className="p-4">
          <h3 className="mb-2 font-semibold text-red-600">Danger Zone</h3>
          <Button variant="outline" onClick={handleArchive} className="text-red-600 hover:bg-red-50">
            Archive Chain
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Inline item editor
function ItemEditor({
  item,
  onSave,
  onCancel,
}: {
  item: ContainerItem;
  onSave: (text: string, conditions?: ItemConditions | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [conditions, setConditions] = useState<ItemConditions>(item.conditions || {});

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
