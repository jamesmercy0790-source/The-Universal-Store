import { notFound } from "next/navigation";
import Link from "next/link";
import { getCjProductPreview } from "@/lib/services/cj-import";
import { listCategories } from "@/lib/services/catalog";
import { CjImportForm } from "@/components/admin/CjImportForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ pid: string }>;
}

export default async function AdminCjImportPage({ params }: Props) {
  const { pid } = await params;

  const categories = await listCategories();
  const preview = await getCjProductPreview(pid, categories[0]?.id ?? null);

  if (!preview) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-bone-100">{preview.detail.title}</h1>
        <Link href="/admin/cj" className="text-sm text-brass-400 hover:text-brass-300">
          ← Back to search
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-sm border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-bone-500">
          No categories exist yet — create at least one category before importing products.
        </p>
      ) : (
        <CjImportForm supplierProductId={pid} preview={preview} categories={categories} />
      )}
    </div>
  );
}
