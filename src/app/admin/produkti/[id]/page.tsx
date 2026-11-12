import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminSkeleton } from "@/components/admin/bits";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const metadata: Metadata = { title: "Редакция на продукт" };

type Props = PageProps<"/admin/produkti/[id]">;

async function Editor({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const { returnUrl } = (await searchParams) ?? {};
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ProductEditor id={id} returnUrl={typeof returnUrl === "string" ? returnUrl : undefined} />;
}

export default function Page({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}
