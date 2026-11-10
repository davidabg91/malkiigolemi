import type { Metadata } from "next";
import { AuthPage } from "@/components/account/AuthPage";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default function Page({ searchParams }: PageProps<"/vhod">) {
  return (
    <AuthPage
      mode="login"
      title="Добре дошъл отново"
      text="Влез, за да виждаш поръчките си и да поръчваш по-бързо."
      searchParams={searchParams}
    />
  );
}
