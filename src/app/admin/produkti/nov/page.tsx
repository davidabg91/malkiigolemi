import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSkeleton } from "@/components/admin/bits";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const metadata: Metadata = { title: "Нов продукт" };

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ProductEditor />
    </Suspense>
  );
}
