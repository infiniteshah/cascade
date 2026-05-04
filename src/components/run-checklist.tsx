"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConditionBadges } from "@/components/condition-badges";
import { AddRunItemModal } from "@/components/add-run-item-modal";
import { toggleRunItem, overrideItemVisibility, completeRun, addRunItem } from "@/lib/actions/runs";
import type { RunWithItems } from "@/lib/actions/runs";
import type { ContainerType, ItemConditions } from "@/lib/types/containers";

interface HouseholdMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RunChecklistProps {
  run: RunWithItems;
  containerType: ContainerType;
  containerName: string;
  householdMembers?: HouseholdMember[];
  currentUserId?: string;
  onUpdate: () => void;
}

export function RunChecklist({
  run,
  containerType,
  containerName,
  householdMembers = [],
  currentUserId,
  onUpdate,
}: RunChecklistProps) {
  const [isPending, startTransition] = useTransition();
  const [expandHidden, setExpandHidden] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const visibleItems = run.items.filter((item) => item.is_visible);
  const hiddenItems = run.items.filter((item) => !item.is_visible);

  const handleAddItem = async (item: {
    text: string;
    position: number;
    conditions?: ItemConditions;
  }) => {
    await addRunItem(run.id, item);
    onUpdate();
  };

  // Helper to get member info
  const getMemberInfo = (userId: string | null) => {
    if (!userId) return null;
    return householdMembers.find((m) => m.id === userId);
  };

  // Helper to get initials
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Find the next unchecked visible item
  const nextItemId = visibleItems.find((item) => !item.is_checked)?.id;

  const isCompleted = run.completed_at !== null;
  const allVisibleChecked = visibleItems.every((item) => item.is_checked);

  const handleToggle = (runItemId: string, currentlyChecked: boolean) => {
    startTransition(async () => {
      await toggleRunItem(runItemId, !currentlyChecked);
      onUpdate();
    });
  };

  const handleShowHiddenItem = (runItemId: string) => {
    startTransition(async () => {
      await overrideItemVisibility(runItemId);
      onUpdate();
    });
  };

  const handleComplete = () => {
    startTransition(async () => {
      await completeRun(run.id);
      onUpdate();
    });
  };

  return (
    <div className="space-y-4">
      {/* Completion Banner */}
      {isCompleted && (
        <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950">
          <p className="text-lg font-medium text-green-800 dark:text-green-200">
            ✓ Run Complete!
          </p>
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
            Finished at {new Date(run.completed_at!).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Visible Items */}
      <div className="space-y-2">
        <AnimatePresence>
          {visibleItems.map((item) => {
            const isNext = item.id === nextItemId && !isCompleted;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                layout
              >
                <Card
                  className={`transition-all ${
                    isNext
                      ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900"
                      : ""
                  } ${item.is_checked ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-0">
                    <button
                      onClick={() => handleToggle(item.id, item.is_checked)}
                      disabled={isPending || isCompleted}
                      className="flex w-full items-start gap-3 p-4 text-left"
                    >
                      {/* Checkbox */}
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          item.is_checked
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-zinc-300 dark:border-zinc-600"
                        }`}
                      >
                        {item.is_checked && (
                          <motion.svg
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </motion.svg>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm ${
                              item.is_checked
                                ? "line-through text-zinc-500"
                                : "text-zinc-900 dark:text-zinc-100"
                            }`}
                          >
                            {item.container_item.text}
                          </p>
                          {isNext && (
                            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              Next
                            </span>
                          )}
                        </div>
                        {containerType === "chain" &&
                          item.container_item.conditions &&
                          Object.keys(item.container_item.conditions).length > 0 && (
                            <div className="mt-1">
                              <ConditionBadges
                                conditions={item.container_item.conditions}
                                size="sm"
                              />
                            </div>
                          )}
                        {item.manual_override && (
                          <p className="mt-1 text-[10px] text-zinc-400">
                            Manually shown
                          </p>
                        )}
                      </div>

                      {/* Avatar marker for who checked */}
                      {item.is_checked && item.checked_by && item.checked_by !== currentUserId && (
                        <div className="shrink-0">
                          {getMemberInfo(item.checked_by)?.avatar_url ? (
                            <img
                              src={getMemberInfo(item.checked_by)!.avatar_url!}
                              alt=""
                              className="h-6 w-6 rounded-full"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              {getInitials(getMemberInfo(item.checked_by)?.display_name ?? null)}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Hidden Items Expander (chains only) */}
      {containerType === "chain" && hiddenItems.length > 0 && (
        <div>
          <button
            onClick={() => setExpandHidden(!expandHidden)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <span>{expandHidden ? "Hide" : "Show"} {hiddenItems.length} hidden items</span>
            <span className="text-xs">{expandHidden ? "▲" : "▼"}</span>
          </button>

          <AnimatePresence>
            {expandHidden && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 space-y-2 overflow-hidden"
              >
                {hiddenItems.map((item) => (
                  <Card key={item.id} className="opacity-50">
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex-1">
                        <p className="text-sm text-zinc-500">
                          {item.container_item.text}
                        </p>
                        {item.container_item.conditions && (
                          <div className="mt-1">
                            <ConditionBadges
                              conditions={item.container_item.conditions}
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleShowHiddenItem(item.id)}
                        disabled={isPending}
                      >
                        Show
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Add Item Button */}
      {!isCompleted && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setShowAddModal(true)}
            disabled={isPending}
            className="w-full"
          >
            + Add Item
          </Button>
        </div>
      )}

      {/* Manual Complete Button */}
      {!isCompleted && allVisibleChecked && visibleItems.length > 0 && (
        <div className="text-center">
          <Button onClick={handleComplete} disabled={isPending}>
            Mark as Complete
          </Button>
        </div>
      )}

      {/* Add Item Modal */}
      <AddRunItemModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
        containerType={containerType}
        containerName={containerName}
        existingItems={run.items.map((item) => ({
          text: item.container_item.text,
          position: item.container_item.position,
        }))}
      />
    </div>
  );
}
