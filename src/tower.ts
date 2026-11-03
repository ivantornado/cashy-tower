import {
  CASH_CHANCE,
  CASH_MIN_FLOOR,
  CASH_MIN_GAP,
  FLOOR_GAP,
  INNER_L,
  INNER_R,
  INNER_W,
  LEDGE_REACH,
  LEDGE_WIDTH,
  LEDGE_WIDTH_JITTER,
  MILESTONE_EVERY,
  TRAMPOLINE_CHANCE,
  type Curve,
} from "./config";

export type Ledge = {
  index: number;
  /** Ground and milestone floors span the whole tower. */
  kind: "ground" | "milestone" | "ledge";
  x: number;
  w: number;
  /** The whole ledge is a trampoline. */
  trampoline?: { bouncedAt: number };
  cash?: { x: number; taken: boolean };
};

export function curve(points: Curve, at: number) {
  if (at <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (at <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (at - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

export function floorTop(index: number) {
  return -index * FLOOR_GAP;
}

/** Builds floors on demand as Cashy climbs, so the tower never runs out. */
export class Tower {
  private ledges: Ledge[] = [];
  private lastCash = 0;
  private lastCentre = INNER_L + INNER_W / 2;

  get(index: number): Ledge {
    while (this.ledges.length <= index) this.ledges.push(this.build(this.ledges.length));
    return this.ledges[index];
  }

  private build(index: number): Ledge {
    if (index === 0) return { index, kind: "ground", x: INNER_L, w: INNER_W };
    if (index % MILESTONE_EVERY === 0) {
      this.lastCentre = INNER_L + INNER_W / 2;
      return { index, kind: "milestone", x: INNER_L, w: INNER_W };
    }

    const w = Math.round(curve(LEDGE_WIDTH, index) * (1 + (Math.random() * 2 - 1) * LEDGE_WIDTH_JITTER));
    // Stay within reach of the last ledge, so the width of the tower never makes a floor impossible.
    const low = Math.max(INNER_L + w / 2, this.lastCentre - LEDGE_REACH);
    const high = Math.min(INNER_R - w / 2, this.lastCentre + LEDGE_REACH);
    const centre = low + Math.random() * (high - low);
    this.lastCentre = centre;
    const x = centre - w / 2;
    const ledge: Ledge = { index, kind: "ledge", x, w };

    if (index >= 3 && Math.random() < curve(TRAMPOLINE_CHANCE, index)) {
      ledge.trampoline = { bouncedAt: -Infinity };
    } else if (index >= CASH_MIN_FLOOR && index - this.lastCash >= CASH_MIN_GAP && Math.random() < CASH_CHANCE) {
      ledge.cash = { x: x + w / 2, taken: false };
      this.lastCash = index;
    }
    return ledge;
  }
}
