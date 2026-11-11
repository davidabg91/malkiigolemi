// Point arithmetic shared by the checkout preview (browser) and the order itself (server).

export type LoyaltySettings = {
  enabled: boolean;
  /** Points for every whole euro of goods (shipping does not count). */
  pointsPerEuro: number;
  /** What 100 points are worth, in cents. */
  centsPer100: number;
  /** Fewest points that can be used at once. */
  minRedeem: number;
  /** Largest share of the goods that points may pay for, in percent. */
  maxPercent: number;
};

// A deliberately small reward: 1 point per euro, 100 points = 0,50 € → 0,5% back.
export const DEFAULT_LOYALTY: LoyaltySettings = { enabled: true, pointsPerEuro: 1, centsPer100: 50, minRedeem: 100, maxPercent: 20 };

export const pointsValue = (points: number, s: LoyaltySettings) => Math.floor((points * s.centsPer100) / 100);
export const pointsForGoods = (cents: number, s: LoyaltySettings) => Math.floor((cents / 100) * s.pointsPerEuro);

/** How many points an order may use and what they take off: at most maxPercent of the goods, nothing below minRedeem. */
export function redeemable(balance: number, goodsCents: number, s: LoyaltySettings) {
  if (!s.enabled || s.centsPer100 <= 0) return { points: 0, discount: 0 };
  const capCents = Math.floor((goodsCents * s.maxPercent) / 100);
  const points = Math.min(balance, Math.floor((capCents * 100) / s.centsPer100));
  if (points < s.minRedeem) return { points: 0, discount: 0 };
  return { points, discount: pointsValue(points, s) };
}
