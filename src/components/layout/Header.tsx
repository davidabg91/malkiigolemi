import { Truck } from "lucide-react";
import { FacebookIcon } from "@/components/ui";
import { getCategoryTree } from "@/lib/queries";
import { site } from "@/lib/site";
import { HeaderClient } from "./HeaderClient";

export async function Header() {
  const tree = await getCategoryTree();

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
      <HeaderClient
        tree={tree.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          icon: c.icon,
          tone: c.tone,
          count: c.count,
          children: c.children.map((s) => ({ slug: s.slug, name: s.name })),
        }))}
      />
    </>
  );
}
