import type { Metadata } from "next";
import { Suspense } from "react";
import { Listing, ListingHeader, ListingSkeleton } from "@/components/listing/Listing";

export const metadata: Metadata = { title: "Всички продукти", description: "Целият асортимент на едно място — филтрирай по марка, произход и цена." };

async function Content({ searchParams }: Pick<PageProps<"/produkti">, "searchParams">) {
  return <Listing scope={{}} searchParams={await searchParams} basePath="/produkti" />;
}

export default function Page({ searchParams }: PageProps<"/produkti">) {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <ListingHeader crumbs={[{ label: "Всички продукти" }]} title="Всички продукти" description="Целият асортимент на едно място — филтрирай по марка, произход и цена." />
      <Suspense fallback={<ListingSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
