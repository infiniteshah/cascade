"use client";

import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils/date";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ContainerWithMeta } from "@/lib/types/containers";

interface ChainCardProps {
  chain: ContainerWithMeta;
}

export function ChainCard({ chain }: ChainCardProps) {
  const ownerInitial = chain.owner?.display_name?.charAt(0).toUpperCase() || "?";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href={`/chains/${chain.id}`}
              className="block hover:underline"
            >
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {chain.name}
              </h3>
            </Link>
            {chain.trigger_description && (
              <p className="mt-0.5 text-sm italic text-zinc-500 truncate">
                {chain.trigger_description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
              <span>{chain.item_count} items</span>
              {chain.last_run_at && (
                <>
                  <span>•</span>
                  <span>Last run {formatDistanceToNow(chain.last_run_at)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {chain.is_shared && (
              <div className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={chain.owner?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">{ownerInitial}</AvatarFallback>
                </Avatar>
                <span className="text-zinc-600 dark:text-zinc-400">Shared</span>
              </div>
            )}
            <Link href={`/chains/${chain.id}/run`}>
              <Button size="sm">Run</Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
