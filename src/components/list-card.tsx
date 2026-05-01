"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ContainerWithMeta } from "@/lib/types/containers";

interface ListCardProps {
  list: ContainerWithMeta;
}

export function ListCard({ list }: ListCardProps) {
  const ownerInitial = list.owner?.display_name?.charAt(0).toUpperCase() || "?";

  // TODO: Get actual progress from run_items
  const progress = 0;
  const total = list.item_count;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href={`/lists/${list.id}`}
              className="block hover:underline"
            >
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {list.name}
              </h3>
            </Link>
            {list.description && (
              <p className="mt-0.5 text-sm text-zinc-500 truncate">
                {list.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
              <span>{progress} of {total} done</span>
              {/* Progress bar */}
              <div className="h-1.5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: total > 0 ? `${(progress / total) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {list.is_shared && (
              <div className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={list.owner?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">{ownerInitial}</AvatarFallback>
                </Avatar>
                <span className="text-zinc-600 dark:text-zinc-400">Shared</span>
              </div>
            )}
            <Link href={`/lists/${list.id}`}>
              <Button size="sm" variant="outline">Open</Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
