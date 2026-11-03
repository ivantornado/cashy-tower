import { COLOURS as C, MILESTONE_EVERY } from "./config";

/** How a ledge looks. All designs play identically: only the drawing differs. */
export type Design = {
  name: string;
  /** Used for the tower walls, the big floor numbers and the floor banner. */
  colour: string;
  /** Draws one ledge into the box x, y, w, h. `seed` is the floor number, so decoration stays put. */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number, seed: number): void;
};

/** Steady pseudo-random 0 to 1 for a seed and slot, so a ledge's icicles and leaves never jump around. */
function noise(seed: number, slot: number) {
  const v = Math.sin(seed * 127.1 + slot * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function halo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x - 3, y - 6, w + 6, h + 10, 9);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function neon(name: string, colour: string): Design {
  return {
    name,
    colour,
    draw(ctx, x, y, w, h) {
      halo(ctx, x, y, w, h, colour, 0.2);
      ctx.fillStyle = C.ledge;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colour;
      ctx.fillRect(x + 3, y + 1, w - 6, 4);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(x + 3, y + h - 4, w - 6, 3);
    },
  };
}

const ice: Design = {
  name: "Ice",
  colour: "#7fe0ff",
  draw(ctx, x, y, w, h, time, seed) {
    halo(ctx, x, y, w, h, "#7fe0ff", 0.2);
    const body = ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, "#f2feff");
    body.addColorStop(1, "#84d4f0");
    ctx.fillStyle = body;
    ctx.strokeStyle = "#0b2a4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(x + 5, y + 2, w - 10, 2);

    // Icicles hanging underneath, each a different length.
    const icicles = Math.max(2, Math.floor(w / 18));
    ctx.fillStyle = "#c4f0ff";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < icicles; i++) {
      const ix = x + 8 + ((w - 16) * (i + 0.5)) / icicles;
      const length = 6 + noise(seed, i) * 11;
      ctx.beginPath();
      ctx.moveTo(ix - 4, y + h - 1);
      ctx.lineTo(ix, y + h + length);
      ctx.lineTo(ix + 4, y + h - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // A twinkle on the top edge.
    const sx = x + 8 + noise(seed, 40) * (w - 16);
    const twinkle = 0.5 + 0.5 * Math.sin(time * 3 + seed);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * twinkle})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 4 * twinkle, y - 4);
    ctx.lineTo(sx + 4 * twinkle, y - 4);
    ctx.moveTo(sx, y - 8 * twinkle);
    ctx.lineTo(sx, y);
    ctx.stroke();
  },
};

const fire: Design = {
  name: "Fire",
  colour: "#ff6a1a",
  draw(ctx, x, y, w, h, time, seed) {
    halo(ctx, x, y, w, h, "#ff6a1a", 0.22 + 0.08 * Math.sin(time * 6 + seed));
    ctx.fillStyle = "#2a1410";
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff5a1a";
    ctx.fillRect(x + 3, y + 1, w - 6, 4);
    ctx.fillStyle = "#ffd21f";
    ctx.fillRect(x + 3, y + 1, w - 6, 1.5);

    // Glowing cracks through the rock.
    ctx.strokeStyle = "#ff7a1a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const steps = Math.max(2, Math.floor(w / 10));
    for (let i = 0; i <= steps; i++) {
      const px = x + 5 + ((w - 10) * i) / steps;
      const py = y + h * 0.68 + (i % 2 ? 2 : -2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Flames licking up off the top.
    const flames = Math.max(2, Math.floor(w / 14));
    for (let i = 0; i < flames; i++) {
      const fx = x + 7 + ((w - 14) * (i + 0.5)) / flames;
      const height = 5 + 5 * (0.5 + 0.5 * Math.sin(time * 9 + i * 1.7 + seed)) + noise(seed, i) * 3;
      ctx.fillStyle = i % 2 ? "#ff7a1a" : "#ffb21f";
      ctx.beginPath();
      ctx.moveTo(fx - 5, y + 1);
      ctx.quadraticCurveTo(fx - 2, y - height * 0.5, fx, y - height);
      ctx.quadraticCurveTo(fx + 2, y - height * 0.5, fx + 5, y + 1);
      ctx.closePath();
      ctx.fill();
    }
  },
};

const leaves: Design = {
  name: "Leaves",
  colour: "#6fe05a",
  draw(ctx, x, y, w, h, time, seed) {
    halo(ctx, x, y, w, h, "#6fe05a", 0.16);
    ctx.fillStyle = "#2f4a22";
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5cc24a";
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 1, w - 4, 5, 3);
    ctx.fill();

    // Leaves sprouting along the top.
    const count = Math.max(2, Math.floor(w / 15));
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#1d3a16";
    for (let i = 0; i < count; i++) {
      const lx = x + 6 + ((w - 12) * (i + 0.5)) / count;
      const tilt = (i % 2 ? 0.6 : -0.6) + (noise(seed, i) - 0.5) * 0.5;
      ctx.fillStyle = i % 2 ? "#7cf06a" : "#4fae3c";
      ctx.beginPath();
      ctx.ellipse(lx, y - 2, 7, 3.2, tilt, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Vines swaying underneath, each ending in a leaf.
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const vines = Math.max(1, Math.floor(w / 40) + 1);
    for (let j = 0; j < vines; j++) {
      const vx = x + 8 + noise(seed, 20 + j) * (w - 16);
      const length = 10 + noise(seed, 30 + j) * 16;
      const sway = Math.sin(time * 1.5 + j + seed) * 2.5;
      ctx.strokeStyle = "#3f8a32";
      ctx.beginPath();
      ctx.moveTo(vx, y + h - 1);
      ctx.quadraticCurveTo(vx + sway, y + h + length * 0.5, vx + sway * 1.4, y + h + length);
      ctx.stroke();
      ctx.fillStyle = "#7cf06a";
      ctx.beginPath();
      ctx.ellipse(vx + sway * 1.4, y + h + length, 4, 2.4, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "butt";
  },
};

const smoke: Design = {
  name: "Smoke",
  colour: "#9aa3b8",
  draw(ctx, x, y, w, h, time, seed) {
    halo(ctx, x, y, w, h, "#9aa3b8", 0.12);
    const body = ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, "#6a7185");
    body.addColorStop(1, "#2c303b");
    ctx.fillStyle = body;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.fill();
    ctx.stroke();

    // Puffs of smoke along the top, each a little different.
    const puffs = Math.max(2, Math.floor(w / 15));
    for (let i = 0; i < puffs; i++) {
      const px = x + 7 + ((w - 14) * (i + 0.5)) / puffs;
      const r = 5 + noise(seed, i) * 4;
      ctx.fillStyle = i % 2 ? "rgba(208, 213, 228, 0.95)" : "rgba(170, 177, 196, 0.95)";
      ctx.strokeStyle = "rgba(15, 17, 24, 0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, y + 1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Wisps curling up and fading.
    const wisps = Math.max(2, Math.floor(w / 28));
    for (let k = 0; k < wisps; k++) {
      const t = (time * 0.45 + noise(seed, 20 + k)) % 1;
      const wx = x + 8 + noise(seed, 30 + k) * (w - 16) + Math.sin(time * 1.6 + k + seed) * 4;
      ctx.fillStyle = `rgba(214, 219, 234, ${0.5 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(wx, y - 4 - t * 24, 3 + t * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

const glass: Design = {
  name: "Glass",
  colour: "#d9f3ff",
  draw(ctx, x, y, w, h, time, seed) {
    // See-through, so the dark outline and bright edge do the work of showing where it is.
    ctx.save();
    const pane = ctx.createLinearGradient(0, y, 0, y + h);
    pane.addColorStop(0, "rgba(214, 246, 255, 0.6)");
    pane.addColorStop(1, "rgba(120, 200, 235, 0.3)");
    ctx.fillStyle = pane;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 4);
    ctx.stroke();

    // Glints sliding across the pane.
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.clip();
    for (let k = 0; k < 2; k++) {
      const gx = x - 24 + ((time * 55 + seed * 37 + k * 80) % (w + 70));
      ctx.fillStyle = k ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.moveTo(gx, y + h);
      ctx.lineTo(gx + (k ? 5 : 10), y + h);
      ctx.lineTo(gx + (k ? 17 : 22), y);
      ctx.lineTo(gx + 12, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(x + 4, y + 2, w - 8, 2);
  },
};

const cash: Design = {
  name: "Cash",
  colour: "#ffd21f",
  draw(ctx, x, y, w, h, time, seed) {
    // A stack of notes: ink outline, a darker layer for the thickness, a bright top note.
    halo(ctx, x, y, w, h, "#ffd21f", 0.16);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, w + 2, h + 2, 5);
    ctx.fill();
    ctx.fillStyle = "#6fa65a";
    ctx.beginPath();
    ctx.roundRect(x, y + 3, w, h - 3, 4);
    ctx.fill();
    ctx.fillStyle = "#a9dd8c";
    ctx.strokeStyle = "#2f5a24";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 5, 3.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x + 3, y + h - 3, w - 6, 1);

    // A medallion with a dollar sign in each stretch of the note.
    const medals = Math.max(1, Math.floor(w / 36));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < medals; i++) {
      const mx = x + (w * (i + 0.5)) / medals;
      ctx.fillStyle = "#d3f0bf";
      ctx.strokeStyle = "#2f5a24";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(mx, y + (h - 5) / 2 + 0.5, 8, (h - 7) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1d3a16";
      ctx.font = "700 8px system-ui, sans-serif";
      ctx.fillText("$", mx, y + (h - 5) / 2 + 1);
    }

    // A gold glint on the top edge.
    const twinkle = 0.5 + 0.5 * Math.sin(time * 3 + seed * 1.7);
    const sx = x + 8 + noise(seed, 50) * (w - 16);
    ctx.strokeStyle = `rgba(255, 224, 110, ${0.4 + 0.6 * twinkle})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 4 * twinkle, y - 4);
    ctx.lineTo(sx + 4 * twinkle, y - 4);
    ctx.moveTo(sx, y - 8 * twinkle);
    ctx.lineTo(sx, y);
    ctx.stroke();
  },
};

/** In the order they appear in a run, and the order you unlock them as a starting design. */
/** Eight designs, one per 50 floors, so a run to the top of the tower (floor 400) sees every one. */
export const DESIGNS: Design[] = [neon("Neon Blue", C.cyan), neon("Neon Green", C.note), ice, fire, leaves, smoke, glass, cash];

/** The first floor you must reach to pick this design as your start: the floor where it first appears. */
export function unlockFloor(design: number) {
  return design * MILESTONE_EVERY;
}

/** Each block of 50 floors steps on to the next design, wrapping round after the last. */
export function designAt(startDesign: number, floor: number) {
  return DESIGNS[(startDesign + Math.floor(floor / MILESTONE_EVERY)) % DESIGNS.length];
}
