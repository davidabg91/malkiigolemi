import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminSkeleton } from "@/components/admin/bits";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const metadata: Metadata = { title: "Редакция на продукт" };

type Props = PageProps<"/admin/produkti/[id]">;

async function Editor({ params }: Pick<Props, "params">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ProductEditor id={id} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}
