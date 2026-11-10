import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const metadata: Metadata = { title: "Редакция на продукт" };

export default async function Page({ params }: PageProps<"/admin/produkti/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ProductEditor id={id} />;
}
