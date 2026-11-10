import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Listing, ListingHeader, ListingSkeleton } from "@/components/listing/Listing";
import { getCategoryPath } from "@/lib/queries";

type Props = PageProps<"/kategoria/[...slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = await getCategoryPath(slug);
  if (!path) return { title: "Категорията не е намерена" };
  const current = path.sub ?? path.root;
  return {
    title: path.sub ? `${path.sub.name} — ${path.root.name}` : path.root.name,
    description: current.description ?? path.root.description ?? undefined,
  };
}

async function Content({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const path = await getCategoryPath(slug);
  if (!path) notFound();
  const { root, sub } = path;
  const base = `/kategoria/${root.slug}`;
  const pill = "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition";

  return (
    <>
      <ListingHeader
        crumbs={sub ? [{ label: root.name, href: base }, { label: sub.name }] : [{ label: root.name }]}
        title={sub?.name ?? root.name}
        description={sub ? null : root.description}
      >
        <ul className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <li>
            <Link href={base} className={`${pill} whitespace-nowrap ${sub ? "bg-paper shadow-soft hover:bg-lime" : "bg-ink text-cream"}`}>
              Всички
            </Link>
          </li>
          {root.children.map((c) => (
            <li key={c.id}>
              <Link
                href={`${base}/${c.slug}`}
                className={`${pill} whitespace-nowrap ${sub?.id === c.id ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </ListingHeader>
      <Listing
        scope={{ categoryIds: sub ? [sub.id] : [root.id, ...root.children.map((c) => c.id)] }}
        searchParams={sp}
        basePath={sub ? `${base}/${sub.slug}` : base}
      />
    </>
  );
}

export default function CategoryPage(props: Props) {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <Suspense fallback={<ListingSkeleton />}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}
