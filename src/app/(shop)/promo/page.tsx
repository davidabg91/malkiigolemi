import type { Metadata } from "next";
import { Suspense } from "react";
import { Listing, ListingHeader, ListingSkeleton } from "@/components/listing/Listing";

export const metadata: Metadata = { title: "Промоции", description: "Намалени цени и оферти за количество — докато има наличност." };

async function Content({ searchParams }: Pick<PageProps<"/promo">, "searchParams">) {
  return <Listing scope={{ promo: true }} searchParams={await searchParams} basePath="/promo" />;
}

export default function Page({ searchParams }: PageProps<"/promo">) {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <ListingHeader crumbs={[{ label: "Промоции" }]} title="Промоции" description="Намалени цени и оферти за количество — докато има наличност." />
      <Suspense fallback={<ListingSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
