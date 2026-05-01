import { notFound } from "next/navigation";
import Link from "next/link";
import { getContainer } from "@/lib/actions/containers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ListPageProps {
  params: Promise<{ id: string }>;
}

export default async function ListPage({ params }: ListPageProps) {
  const { id } = await params;
  const list = await getContainer(id);

  if (!list || list.type !== "list") {
    notFound();
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/lists"
            className="mb-2 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
          >
            ← Back to Lists
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{list.name}</h2>
              {list.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {list.description}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/lists/${id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
              <Link href={`/lists/${id}/run`}>
                <Button>Start</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {list.items.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium dark:bg-zinc-800">
                  {index + 1}
                </span>
                <p className="flex-1 text-sm">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {list.items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-zinc-500">No items yet</p>
            <Link href={`/lists/${id}/edit`} className="mt-2">
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
