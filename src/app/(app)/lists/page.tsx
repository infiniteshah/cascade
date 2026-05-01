import Link from "next/link";
import { getContainers } from "@/lib/actions/containers";
import { ListCard } from "@/components/list-card";
import { Button } from "@/components/ui/button";

export default async function ListsPage() {
  const lists = await getContainers("list");

  // Separate active and archived lists
  const activeLists = lists.filter((l) => !l.archived_at);
  const archivedLists = lists.filter((l) => l.archived_at);

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Lists</h2>
            <p className="text-sm text-zinc-500">
              One-off tasks and project checklists
            </p>
          </div>
          <Link href="/lists/new">
            <Button>New List</Button>
          </Link>
        </div>

        {/* Active Lists */}
        {activeLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <div className="mb-4 text-4xl">📋</div>
            <p className="text-sm text-zinc-500">No lists yet</p>
            <p className="mt-1 text-xs text-zinc-400">
              Create a list for your next project or day off
            </p>
            <Link href="/lists/new" className="mt-4">
              <Button variant="outline">Start Your First List</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeLists.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        )}

        {/* Archived Lists */}
        {archivedLists.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-medium text-zinc-500">
              Recently Archived
            </h3>
            <div className="space-y-2 opacity-60">
              {archivedLists.slice(0, 5).map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
