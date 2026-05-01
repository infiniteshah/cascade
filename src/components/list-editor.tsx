"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  updateContainer,
  addContainerItem,
  updateContainerItem,
  deleteContainerItem,
  reorderContainerItems,
  archiveContainer,
} from "@/lib/actions/containers";
import type { ContainerWithItems, ContainerItem } from "@/lib/types/containers";

interface ListEditorProps {
  list: ContainerWithItems;
}

export function ListEditor({ list }: ListEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description || "");
  const [isShared, setIsShared] = useState(list.is_shared);
  const [items, setItems] = useState<ContainerItem[]>(list.items);
  const [newItemText, setNewItemText] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await updateContainer(list.id, {
        name,
        description: description || undefined,
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
      const item = await addContainerItem(list.id, newItemText.trim());
      setItems([...items, item]);
      setNewItemText("");
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (item: ContainerItem) => {
    setEditingItemId(item.id);
    setEditingText(item.text);
  };

  const handleSaveEdit = async () => {
    if (!editingItemId || !editingText.trim()) return;
    setSaving(true);
    try {
      const updated = await updateContainerItem(editingItemId, editingText.trim());
      setItems(items.map((i) => (i.id === editingItemId ? updated : i)));
      setEditingItemId(null);
      setEditingText("");
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
        await reorderContainerItems(list.id, items.map((i) => i.id));
      } finally {
        setSaving(false);
      }
    }
    setDraggedIndex(null);
  };

  const handleArchive = async () => {
    if (!confirm("Archive this list?")) return;
    await archiveContainer(list.id);
    router.push("/lists");
  };

  return (
    <div className="space-y-6">
      {/* List Details */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name"
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
                  <div className="flex gap-2">
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingItemId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-xs dark:bg-zinc-800">
                      ⋮⋮
                    </span>
                    <p className="flex-1 text-sm">{item.text}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStartEdit(item)}
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
            Archive List
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
