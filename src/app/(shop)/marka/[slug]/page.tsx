import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Listing, ListingHeader, ListingSkeleton } from "@/components/listing/Listing";
import { getBrand } from "@/lib/queries";
import { ORIGIN_LABELS } from "@/lib/site";

type Props = PageProps<"/marka/[slug]">;

const describe = (name: string, country: string | null) =>
  `Всички продукти на ${name}${country && ORIGIN_LABELS[country] ? ` — произход ${ORIGIN_LABELS[country]}` : ""}.`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await getBrand((await params).slug);
  if (!brand) return { title: "Марката не е намерена" };
  return { title: brand.name, description: describe(brand.name, brand.country) };
}

async function Content({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);
  if (!brand) notFound();

  return (
    <>
      <ListingHeader crumbs={[{ label: "Всички продукти", href: "/produkti" }, { label: brand.name }]} title={brand.name} description={describe(brand.name, brand.country)} />
      <Listing scope={{ brandId: brand.id }} searchParams={sp} basePath={`/marka/${brand.slug}`} />
    </>
  );
}

export default function BrandPage(props: Props) {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <Suspense fallback={<ListingSkeleton />}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}
