import type { Metadata } from "next";
import { Suspense } from "react";
import { Listing, ListingHeader, ListingSkeleton } from "@/components/listing/Listing";

export const metadata: Metadata = { title: "Търсене", robots: { index: false } };

async function Content({ searchParams }: Pick<PageProps<"/tarsene">, "searchParams">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q ?? "").trim().slice(0, 60);
  return (
    <>
      <ListingHeader
        crumbs={[{ label: "Търсене" }]}
        title={q ? `Резултати за „${q}“` : "Търсене"}
        description={q ? null : "Въведи име на продукт, марка или артикулен номер в полето за търсене."}
      />
      {q && (
        <Listing
          scope={{ q }}
          searchParams={sp}
          basePath="/tarsene"
          preserve={{ q }}
          emptyHint="Провери за правописна грешка или опитай с по-обща дума."
        />
      )}
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/tarsene">) {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <Suspense fallback={<ListingSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
