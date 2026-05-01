import { notFound } from "next/navigation";
import Link from "next/link";
import { getContainer } from "@/lib/actions/containers";
import { ChainEditor } from "@/components/chain-editor";

interface EditChainPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditChainPage({ params }: EditChainPageProps) {
  const { id } = await params;
  const chain = await getContainer(id);

  if (!chain || chain.type !== "chain") {
    notFound();
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/chains/${id}`}
          className="mb-4 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← Back to Chain
        </Link>
        <h2 className="mb-6 text-2xl font-bold">Edit Chain</h2>
        <ChainEditor chain={chain} />
      </div>
    </div>
  );
}
