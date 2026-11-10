import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const metadata: Metadata = { title: "Нов продукт" };

export default function Page() {
  return <ProductEditor />;
}
