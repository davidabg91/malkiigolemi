/**
 * Ready-made illustrations for the category tiles on the home page. A category's `tile` is one of these
 * keys, "auto" (photos of its own newest products), or the address of a picture the admin uploaded.
 */
export interface ShowcaseItem {
  src: string;
  alt: string;
  className: string;
}

export const TILE_PRESETS: Record<string, ShowcaseItem[]> = {
  hrani: [
    {
      src: "/dececco-isolated.png",
      alt: "De Cecco Спагети",
      className: "bottom-[6%] right-[36%] h-[66%] w-auto -rotate-12 group-hover:-translate-x-2 group-hover:-rotate-[16deg]",
    },
    {
      src: "/food-isolated.png",
      alt: "Гурме паста с босилек",
      className: "-bottom-[3%] -right-[3%] h-[66%] w-auto rotate-3 group-hover:translate-x-1 group-hover:rotate-6 group-hover:scale-105",
    },
  ],
  "kafe-i-chai": [
    {
      src: "/kafe-2.png",
      alt: "Illy Espresso кафе",
      className: "bottom-[6%] right-[34%] h-[52%] w-auto -rotate-10 group-hover:-translate-x-2 group-hover:-rotate-[14deg]",
    },
    {
      src: "/kafe-1.png",
      alt: "Lavazza Qualità Oro кафе",
      className: "-bottom-[2%] -right-[2%] h-[72%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  igrachki: [
    {
      src: "/igrachki-wood.png",
      alt: "Монтесори образователна дървена пирамида",
      className: "-bottom-[11%] left-[2%] z-10 h-[73%] w-auto -rotate-3 group-hover:-translate-x-1 group-hover:-rotate-6",
    },
    {
      src: "/igrachki-bear.png",
      alt: "Плюшено мече с панделка",
      className: "-bottom-[6%] left-[24%] z-20 h-[104%] w-auto group-hover:-translate-y-1.5 group-hover:rotate-2",
    },
    {
      src: "/igrachki-car.png",
      alt: "Спортна състезателна количка",
      className: "-bottom-[19%] left-[50%] z-30 h-[66%] w-auto -rotate-2 group-hover:translate-x-2",
    },
    {
      src: "/igrachki-lego.png",
      alt: "LEGO строител и конструктор",
      className: "-bottom-[13%] left-[54%] h-[115%] w-auto rotate-3 group-hover:translate-x-1 group-hover:rotate-6",
    },
  ],
  napitki: [
    {
      src: "/napitki-juice.png",
      alt: "Натурален портокалов фреш с плодове",
      className: "bottom-[2%] right-[52%] h-[54%] w-auto -rotate-6 group-hover:-translate-x-3 group-hover:-rotate-[10deg]",
    },
    {
      src: "/napitki-evian.png",
      alt: "Evian натурална минерална вода",
      className: "bottom-[4%] right-[35%] h-[68%] w-auto rotate-3 group-hover:-translate-y-2 group-hover:rotate-6",
    },
    {
      src: "/napitki-1.png",
      alt: "San Pellegrino газирана вода",
      className: "bottom-[1%] right-[18%] h-[72%] w-auto -rotate-6 group-hover:-translate-x-1 group-hover:-rotate-[10deg]",
    },
    {
      src: "/napitki-2.png",
      alt: "Coca-Cola Classic бутилка",
      className: "-bottom-[3%] -right-[1%] h-[78%] w-auto rotate-8 group-hover:translate-x-2 group-hover:rotate-[12deg] group-hover:scale-105",
    },
  ],
  "pochistvane-i-prane": [
    {
      src: "/pochistvane-1.png",
      alt: "Ariel All-in-1 Pods капсули",
      className: "bottom-[6%] right-[32%] h-[52%] w-auto -rotate-8 group-hover:-translate-x-2 group-hover:-rotate-[12deg]",
    },
    {
      src: "/pochistvane-2.png",
      alt: "Lenor Gold Orchid омекотител",
      className: "-bottom-[2%] -right-[2%] h-[74%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  kozmetika: [
    {
      src: "/kozmetika-1.png",
      alt: "Nivea Creme крем",
      className: "bottom-[6%] right-[38%] h-[50%] w-auto -rotate-12 group-hover:-translate-x-2 group-hover:-rotate-[16deg]",
    },
    {
      src: "/kozmetika-2.png",
      alt: "L'Oréal Revitalift серум",
      className: "-bottom-[2%] -right-[1%] h-[70%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  "bebe-i-dete": [
    {
      src: "/bebe-1.png",
      alt: "Pampers Premium Care пелени",
      className: "bottom-[5%] right-[32%] h-[58%] w-auto -rotate-8 group-hover:-translate-x-2 group-hover:-rotate-[12deg]",
    },
    {
      src: "/bebe-2.png",
      alt: "Hipp Organic бебешко пюре",
      className: "-bottom-[1%] -right-[1%] h-[60%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  "dom-i-ofis": [
    {
      src: "/dom-2.png",
      alt: "Moleskine тефтер и Parker химикалка",
      className: "bottom-[5%] right-[32%] h-[58%] w-auto -rotate-8 group-hover:-translate-x-2 group-hover:-rotate-[12deg]",
    },
    {
      src: "/dom-1.png",
      alt: "Yankee Candle ароматна свещ",
      className: "-bottom-[2%] -right-[1%] h-[68%] w-auto rotate-4 group-hover:translate-x-1 group-hover:rotate-[8deg] group-hover:scale-105",
    },
  ],
};

/**
 * Every illustration is laid out inside a box of a fixed shape in the tile's bottom-right corner, and its
 * pictures are placed relative to that box. In a wide tile the products therefore stay together in the
 * corner instead of drifting apart with the tile's width; in a narrow tile the box is simply the tile.
 */
export const TILE_FRAME = "absolute inset-y-0 right-0 aspect-[1.3/1] max-w-full";

/** Illustrations with more products need a wider box, or one of their own. */
export const TILE_FRAMES: Record<string, string> = {
  igrachki: "absolute bottom-0 right-11 aspect-[2.3/1] h-[72%] max-w-[calc(100%-3.25rem)] lg:h-[82%]",
  napitki: "absolute inset-y-0 right-0 aspect-[2.1/1] max-w-full",
};

/** Names of the illustrations, as the admin sees them. */
export const TILE_PRESET_LABELS: Record<string, string> = {
  hrani: "Храни",
  "kafe-i-chai": "Кафе и чай",
  igrachki: "Играчки",
  napitki: "Напитки",
  "pochistvane-i-prane": "Пране и почистване",
  kozmetika: "Козметика",
  "bebe-i-dete": "Бебе и дете",
  "dom-i-ofis": "Дом и офис",
};

export const TILE_AUTO = "auto";
/** Whether a category's `tile` is an uploaded picture rather than a key. */
export const isTileImage = (tile: string | null | undefined): tile is string => Boolean(tile && (tile.startsWith("/") || tile.startsWith("https://")));
