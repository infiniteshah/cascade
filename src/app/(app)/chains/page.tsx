import Link from "next/link";
import { getContainers, seedDefaultChains } from "@/lib/actions/containers";
import { ChainCard } from "@/components/chain-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function ChainsPage() {
  // Seed default chains if needed
  await seedDefaultChains();

  const chains = await getContainers("chain");

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Chains</h2>
            <p className="text-sm text-zinc-500">
              Triggered cascades of related tasks
            </p>
          </div>
          <Link href="/chains/new">
            <Button>New Chain</Button>
          </Link>
        </div>

        {/* Filter Chips - TODO: implement filtering */}
        <div className="mb-4 flex gap-2">
          <button className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            All
          </button>
          <button className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
            Mine
          </button>
          <button className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
            Shared
          </button>
        </div>

        {/* Chain List */}
        {chains.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <div className="mb-4 text-4xl">🔗</div>
            <p className="text-sm text-zinc-500">No chains yet</p>
            <p className="mt-1 text-xs text-zinc-400">
              Create your first chain to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chains.map((chain) => (
              <ChainCard key={chain.id} chain={chain} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
