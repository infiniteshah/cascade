import { notFound } from "next/navigation";
import Link from "next/link";
import { getContainer } from "@/lib/actions/containers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConditionBadges } from "@/components/condition-badges";

interface ChainPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChainPage({ params }: ChainPageProps) {
  const { id } = await params;
  const chain = await getContainer(id);

  if (!chain || chain.type !== "chain") {
    notFound();
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/chains"
            className="mb-2 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
          >
            ← Back to Chains
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{chain.name}</h2>
              {chain.trigger_description && (
                <p className="mt-1 text-sm italic text-zinc-500">
                  {chain.trigger_description}
                </p>
              )}
              {chain.description && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {chain.description}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/chains/${id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
              <Link href={`/chains/${id}/run`}>
                <Button>Run</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {chain.items.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium dark:bg-zinc-800">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.text}</p>
                  {item.conditions && Object.keys(item.conditions).length > 0 && (
                    <div className="mt-1">
                      <ConditionBadges conditions={item.conditions} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {chain.items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-zinc-500">No items yet</p>
            <Link href={`/chains/${id}/edit`} className="mt-2">
              <Button variant="outline" size="sm">
                Add Items
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
