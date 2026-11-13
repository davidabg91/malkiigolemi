import { Truck } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { FacebookIcon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getCategoryTree } from "@/lib/queries";
import { site } from "@/lib/site";
import { HeaderClient, type MenuCategory } from "./HeaderClient";

/**
 * Reads the session on the server, so the admin-only menu tools need no extra request from every
 * visitor's browser. Until it streams in, the plain header (no admin tools) is shown.
 */
async function SessionHeader({ tree }: { tree: MenuCategory[] }) {
  // Checking the session compares its expiry with the current time, so it must wait for the real request.
  await connection();
  const session = await getSession();
  return <HeaderClient tree={tree} isAdmin={session?.role === "admin"} />;
}

export async function Header() {
  const tree = await getCategoryTree();
  const menu: MenuCategory[] = tree.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    tone: c.tone,
    count: c.count,
    children: c.children.map((s) => ({ slug: s.slug, name: s.name })),
  }));

  return (
    <>
      <div className="bg-forest-deep text-cream">
        {/* On phones only the free-delivery line, centred; the Facebook link is in the menu and footer. */}
        <div className="container-shop flex h-9 items-center justify-center text-[0.8rem] font-medium sm:justify-between">
          <p className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-cyan-400" aria-hidden />
            <span className="whitespace-nowrap">Безплатна доставка с BoxNow</span>
          </p>
          <a
            href={site.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Официална Facebook група на Поръчки за малки и големи"
            className="hidden items-center gap-1.5 whitespace-nowrap font-semibold text-cyan-300 transition hover:text-white sm:flex"
          >
            <FacebookIcon className="h-3.5 w-3.5" />
            <span>Нашата общност:</span>
            <span>Facebook група</span>
          </a>
        </div>
      </div>
      <Suspense fallback={<HeaderClient tree={menu} isAdmin={false} />}>
        <SessionHeader tree={menu} />
      </Suspense>
    </>
  );
}
