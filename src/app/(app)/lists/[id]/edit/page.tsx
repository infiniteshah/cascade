import { notFound } from "next/navigation";
import Link from "next/link";
import { getContainer } from "@/lib/actions/containers";
import { ListEditor } from "@/components/list-editor";

interface EditListPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListPage({ params }: EditListPageProps) {
  const { id } = await params;
  const list = await getContainer(id);

  if (!list || list.type !== "list") {
    notFound();
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/lists/${id}`}
          className="mb-4 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← Back to List
        </Link>
        <h2 className="mb-6 text-2xl font-bold">Edit List</h2>
        <ListEditor list={list} />
      </div>
    </div>
  );
}
