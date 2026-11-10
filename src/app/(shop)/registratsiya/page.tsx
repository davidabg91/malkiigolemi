import type { Metadata } from "next";
import { AuthPage } from "@/components/account/AuthPage";

export const metadata: Metadata = { title: "Регистрация", robots: { index: false } };

export default function Page({ searchParams }: PageProps<"/registratsiya">) {
  return (
    <AuthPage
      mode="register"
      title="Създай профил"
      text="Запазваме данните ти, за да поръчваш с два клика и да следиш поръчките си."
      searchParams={searchParams}
    />
  );
}
