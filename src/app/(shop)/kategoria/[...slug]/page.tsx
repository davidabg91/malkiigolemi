import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Listing, ListingHeader, ListingSkeleton } from "@/components/listing/Listing";
import { getCategoryPath, getRenamedCategoryPath } from "@/lib/queries";
import { breadcrumbJsonLd, jsonLdHtml } from "@/lib/seo";
import { site } from "@/lib/site";

type Props = PageProps<"/kategoria/[...slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = await getCategoryPath(slug);
  if (!path) return { title: "Категорията не е намерена", robots: { index: false } };
  const current = path.sub ?? path.root;
  const canonical = path.sub ? `/kategoria/${path.root.slug}/${path.sub.slug}` : `/kategoria/${path.root.slug}`;
  const name = path.sub ? `${path.sub.name} — ${path.root.name}` : path.root.name;
  return {
    title: `${name} — купи онлайн`,
    description:
      current.description ??
      `${current.name}${path.sub ? ` от категория ${path.root.name}` : ""}: разгледай всички продукти с цени в евро и поръчай онлайн с бърза доставка до офис, адрес или автомат в цяла България.`,
    // Sorting and filters show the same products, so they all point at the plain category address.
    alternates: { canonical },
    openGraph: { type: "website", siteName: site.name, locale: "bg_BG", title: name, url: canonical },
  };
}

async function Content({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const path = await getCategoryPath(slug);
  if (!path) {
    // A renamed category: send the old address on to the new one.
    const moved = await getRenamedCategoryPath(slug);
    if (moved && moved !== `/kategoria/${slug.join("/")}`) permanentRedirect(moved);
    notFound();
  }
  const { root, sub } = path;
  const base = `/kategoria/${root.slug}`;
  const pill = "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition";

  const crumbs = breadcrumbJsonLd([
    { name: root.name, path: base },
    ...(sub ? [{ name: sub.name, path: `${base}/${sub.slug}` }] : []),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(crumbs)} />
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
