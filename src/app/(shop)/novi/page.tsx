import type { Metadata } from "next";
import { Suspense } from "react";
import { Listing, ListingHeader, ListingSkeleton } from "@/components/listing/Listing";

export const metadata: Metadata = { title: "Нови продукти", description: "Последните попълнения в магазина." };

async function Content({ searchParams }: Pick<PageProps<"/novi">, "searchParams">) {
  return <Listing scope={{ isNew: true }} searchParams={await searchParams} basePath="/novi" />;
}

export default function Page({ searchParams }: PageProps<"/novi">) {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <ListingHeader crumbs={[{ label: "Нови продукти" }]} title="Нови продукти" description="Последните попълнения в магазина." />
      <Suspense fallback={<ListingSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
