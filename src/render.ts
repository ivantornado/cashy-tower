import { DISPLAY_FONT, UI_FONT, type Assets } from "./assets";
import {
  CASH_FLOAT,
  COLOURS as C,
  COMBO_TIME,
  FLOOR_GAP,
  INNER_L,
  INNER_R,
  INNER_W,
  LABEL_EVERY,
  LEDGE_H,
  MAX_RUN,
  MILESTONE_EVERY,
  MUSIC_BUTTON,
  SPEED_UP_EVERY,
  VIEW_H,
  VIEW_W,
  WALL_W,
  WIN_MENU_DELAY,
} from "./config";
import { DESIGNS, type Design } from "./designs";
import { MENU_ITEMS, RESTART_DELAY, type Game, type Popup } from "./game";
import { floorTop, type Ledge } from "./tower";

const TILE_H = 528;
const BRICK_H = 24;
const MAX_TEXT_W = INNER_W - 40;
/** Glow padding under the boots in the cutouts: 48px of 983 in the source art. */
const SPRITE_PAD = 48 / 983;
const STANDING_H = 94;
const CROUCHING_H = 88;

const mod = (value: number, size: number) => ((value % size) + size) % size;
const formatNumber = (value: number) => value.toLocaleString("en-GB");

/** Small seeded random, so the back wall looks the same every time. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One repeating tile of the tower's back wall: dark panels and a few lit windows. */
function paintBackWall() {
  const canvas = document.createElement("canvas");
  canvas.width = INNER_W * 2;
  canvas.height = TILE_H * 2;
  const g = canvas.getContext("2d")!;
  g.scale(2, 2);
  const random = seededRandom(8453);
  const lights = [C.cyan, C.magenta, C.hoodie, C.base];
  const cols = Math.round(INNER_W / 92);
  const rowH = 66;
  const cellW = INNER_W / cols;

  g.fillStyle = "#0a0f27";
  g.fillRect(0, 0, INNER_W, TILE_H);
  for (let row = 0; row < TILE_H / rowH; row++) {
    for (let col = 0; col < cols; col++) {
      const x = Math.round(col * cellW + (cellW - 30) / 2);
      const y = row * rowH + 13;
      g.fillStyle = "#121a3c";
      g.fillRect(x - 3, y - 3, 36, 46);
      if (random() < 0.3) {
        g.fillStyle = lights[Math.floor(random() * lights.length)];
        g.globalAlpha = 0.22;
        g.fillRect(x, y, 30, 40);
        g.globalAlpha = 0.35;
        g.fillRect(x + 3, y + 3, 10, 34);
        g.globalAlpha = 1;
      } else {
        g.fillStyle = "#060a1a";
        g.fillRect(x, y, 30, 40);
      }
      g.fillStyle = "#121a3c";
      g.fillRect(x + 14, y, 2, 40);
    }
  }
  return canvas;
}

export class Renderer {
  private scale = 1;
  private backWall = paintBackWall();

  constructor(
    private ctx: CanvasRenderingContext2D,
    private assets: Assets,
  ) {}

  setScale(scale: number) {
    this.scale = scale;
  }

  draw(game: Game, musicOn: boolean) {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // Paint the whole frame first: the zoom can pull the view past the edge of the tower.
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const cam = game.camY;
    const first = Math.max(0, Math.floor(-(cam + VIEW_H) / FLOOR_GAP) - 1);
    const last = Math.ceil(-cam / FLOOR_GAP) + 1;

    // The tower, then the flying cash and confetti, then Cashy on top so nothing hides his face.
    ctx.save();
    if (game.state === "won") this.applyWinZoom(game, cam);
    this.drawBackWall(cam);
    for (let i = first; i <= last; i++) {
      if (i > 0 && i % MILESTONE_EVERY === 0) this.drawMilestoneNumber(i, floorTop(i) - cam, game.designAt(i).colour);
    }
    for (let i = first; i <= last; i++) this.drawLedge(game.tower.get(i), floorTop(i) - cam, game.time, game.designAt(i));
    ctx.restore();

    this.drawNotes(game);

    ctx.save();
    if (game.state === "won") this.applyWinZoom(game, cam);
    this.drawPlayer(game, cam);
    this.drawWalls(game, cam);
    this.drawWorldPopups(game.popups, cam);
    ctx.restore();

    if (game.state === "playing" || game.state === "paused" || game.state === "over") this.drawHud(game);
    if (game.state === "playing") this.drawScreenPopups(game.popups);

    if (game.state === "title") this.drawTitle(game);
    else if (game.state === "paused") this.drawPaused();
    else if (game.state === "over") this.drawGameOver(game);
    else if (game.state === "won") this.drawWon(game);
    else if (game.state === "records") this.drawRecords(game);
    else if (game.state === "settings") this.drawSettings(game);
    this.drawMusicButton(musicOn);
  }

  /** Slowly zoom in on Cashy's head, gliding it to the upper middle of the screen. */
  private applyWinZoom(game: Game, cam: number) {
    const { ctx } = this;
    const player = game.player;
    const z = game.zoomLevel;
    const fx = player.centerX;
    const fy = player.bottom - cam - 70;
    // Keep the edges of the tower off-screen: the world must still cover the whole view.
    const tx = Math.min(fx * z, Math.max(VIEW_W - (VIEW_W - fx) * z, fx + (VIEW_W / 2 - fx) * game.winZoom));
    const ty = fy + (250 - fy) * game.winZoom;
    ctx.translate(tx, ty);
    ctx.scale(z, z);
    ctx.translate(-fx, -fy);
  }

  private drawBackWall(cam: number) {
    // Half speed, so the wall feels further away than the ledges.
    const offset = mod(-cam * 0.5, TILE_H);
    for (let y = offset - TILE_H; y < VIEW_H; y += TILE_H) {
      this.ctx.drawImage(this.backWall, INNER_L, Math.round(y), INNER_W, TILE_H);
    }
  }

  private drawMilestoneNumber(index: number, y: number, colour: string) {
    const { ctx } = this;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = colour;
    ctx.font = `150px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(index), VIEW_W / 2, y - 30);
    ctx.globalAlpha = 1;
  }

  private drawLedge(ledge: Ledge, y: number, time: number, design: Design) {
    const { ctx } = this;
    const colour = design.colour;

    if (ledge.kind === "ground") {
      ctx.fillStyle = C.ledge;
      ctx.fillRect(INNER_L, y, INNER_W, VIEW_H);
      ctx.fillStyle = colour;
      ctx.fillRect(INNER_L, y, INNER_W, 4);
      return;
    }

    if (ledge.trampoline) {
      this.drawTrampoline(ledge, y, time);
      return;
    }

    const h = ledge.kind === "milestone" ? 22 : LEDGE_H;
    design.draw(ctx, ledge.x, y, ledge.w, h, time, ledge.index);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (ledge.kind === "milestone") {
      ctx.fillStyle = C.paper;
      ctx.font = `15px ${DISPLAY_FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.lineJoin = "round";
      ctx.strokeText(`Floor ${ledge.index}`, VIEW_W / 2, y + h / 2 + 1);
      ctx.fillText(`Floor ${ledge.index}`, VIEW_W / 2, y + h / 2 + 1);
    } else if (ledge.index % LABEL_EVERY === 0) {
      ctx.fillStyle = C.paper;
      ctx.font = `700 10px ${UI_FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.lineJoin = "round";
      ctx.strokeText(String(ledge.index), ledge.x + ledge.w / 2, y + h / 2 + 1);
      ctx.fillText(String(ledge.index), ledge.x + ledge.w / 2, y + h / 2 + 1);
    }

    if (ledge.cash && !ledge.cash.taken) {
      const bob = Math.sin(time * 3 + ledge.index) * 3;
      this.drawNote(ledge.cash.x, y - CASH_FLOAT + bob, Math.sin(time * 2 + ledge.index) * 0.12, 1.2, true);
    }
  }

  /** The whole ledge is a bouncy yellow pad: springs underneath, arrows rising off the top. */
  private drawTrampoline(ledge: Ledge, y: number, time: number) {
    const { ctx } = this;
    const { x, w } = ledge;
    const since = time - ledge.trampoline!.bouncedAt;
    const squeeze = since < 0.22 ? Math.sin((since / 0.22) * Math.PI) : 0;
    const dip = squeeze * 6;
    const slab = 8;

    ctx.globalAlpha = 0.28 + 0.1 * Math.sin(time * 5);
    ctx.fillStyle = C.hoodie;
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 10, w + 12, LEDGE_H + 18, 12);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = C.mist;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const coils = Math.max(2, Math.round(w / 16));
    for (let i = 0; i <= coils; i++) {
      const px = x + 4 + ((w - 8) * i) / coils;
      const py = i % 2 ? y + LEDGE_H : y + slab + dip;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = C.hoodie;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y + dip, w, slab, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(x + 4, y + dip + 1.5, w - 8, 2);

    // Arrows drifting up and fading, so it reads as "bounce here" from a distance.
    ctx.strokeStyle = C.hoodie;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const arrows = Math.max(1, Math.round(w / 54));
    for (let a = 0; a < arrows; a++) {
      const ax = x + (w * (a + 0.5)) / arrows;
      for (let k = 0; k < 2; k++) {
        const t = (time * 1.1 + k * 0.5 + a * 0.23) % 1;
        const ay = y - 6 - t * 24;
        ctx.globalAlpha = 0.9 * (1 - t);
        ctx.beginPath();
        ctx.moveTo(ax - 7, ay + 4);
        ctx.lineTo(ax, ay - 3);
        ctx.lineTo(ax + 7, ay + 4);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  }

  /** A cash note. `glow` adds the soft green halo the grabbable ones have. */
  private drawNote(x: number, y: number, rotation: number, scale: number, glow = false) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    if (glow) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = C.note;
      ctx.beginPath();
      ctx.roundRect(-18, -12, 36, 24, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = C.note;
    ctx.strokeStyle = "#2f5a24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-13, -7, 26, 14, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1d3a16";
    ctx.font = `700 10px ${UI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 0.5);
    ctx.restore();
  }

  /** The celebration cash and confetti: screen space, fading out at the end of their life. */
  private drawNotes(game: Game) {
    const { ctx } = this;
    for (const note of game.notes) {
      ctx.globalAlpha = Math.max(0, Math.min(1, (note.life - note.age) / 0.5));
      if (note.kind === "cash") {
        this.drawNote(note.x, note.y, note.rot, note.scale);
        continue;
      }
      if (note.kind === "fire") {
        // White-hot to orange to red as it burns out, with a soft glow around it.
        const t = note.age / note.life;
        const size = note.w * (1 - t * 0.55);
        ctx.fillStyle = t < 0.3 ? "#ffe27a" : t < 0.6 ? "#ff9a2a" : "#e0401a";
        ctx.globalAlpha *= 0.3;
        ctx.beginPath();
        ctx.arc(note.x, note.y, size * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.max(0, Math.min(1, (note.life - note.age) / 0.5));
        ctx.beginPath();
        ctx.arc(note.x, note.y, size, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // Confetti tumbles: its width shrinks to a sliver and back as it flips over.
      ctx.save();
      ctx.translate(note.x, note.y);
      ctx.rotate(note.rot);
      ctx.scale(Math.cos(note.flip), 1);
      ctx.fillStyle = note.colour;
      if (note.round) {
        ctx.beginPath();
        ctx.arc(0, 0, note.h / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-note.w / 2, -note.h / 2, note.w, note.h);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawPlayer(game: Game, cam: number) {
    const { ctx } = this;
    const player = game.player;
    // Standing still or opened up mid-flip; crouched for hops, landings and the start of a flip.
    // On the ending he gets the big grin and the point.
    const crouched = player.crouched || game.state === "won";
    const image = crouched ? this.assets.crouching : this.assets.standing;
    const h = crouched ? CROUCHING_H : STANDING_H;
    const w = (h * image.naturalWidth) / image.naturalHeight;
    const pad = h * SPRITE_PAD;
    const lean = player.grounded ? (player.vx / MAX_RUN) * 0.12 : 0;

    // A soft light behind him so he never gets lost against the windows.
    const glowY = player.bottom - cam - STANDING_H / 2;
    const glow = ctx.createRadialGradient(player.centerX, glowY, 0, player.centerX, glowY, 64);
    glow.addColorStop(0, "rgba(39, 231, 255, 0.22)");
    glow.addColorStop(1, "rgba(39, 231, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(player.centerX - 64, glowY - 64, 128, 128);

    ctx.save();
    // Squash from the feet, spin and flip around the middle of his body.
    ctx.translate(player.centerX, player.bottom - cam + pad);
    ctx.scale(1 / player.squash, player.squash);
    ctx.translate(0, -h / 2);
    ctx.rotate(player.spin * player.facing + lean);
    ctx.scale(player.facing, 1);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private drawWalls(game: Game, cam: number) {
    const { ctx } = this;
    const colour = game.designAt(Math.max(0, Math.floor(-(cam + VIEW_H / 2) / FLOOR_GAP))).colour;
    for (const x of [0, INNER_R]) {
      ctx.fillStyle = C.wall;
      ctx.fillRect(x, 0, WALL_W, VIEW_H);
      ctx.fillStyle = C.wallLine;
      for (let row = Math.floor(cam / BRICK_H); row * BRICK_H - cam < VIEW_H; row++) {
        const y = Math.round(row * BRICK_H - cam);
        ctx.fillRect(x, y, WALL_W, 2);
        ctx.fillRect(x + (row & 1 ? 8 : 18), y, 2, BRICK_H);
      }
      const left = x === 0;
      ctx.fillStyle = colour;
      ctx.fillRect(left ? WALL_W - 3 : INNER_R, 0, 3, VIEW_H);
      ctx.globalAlpha = 0.12;
      ctx.fillRect(left ? WALL_W : INNER_R - 12, 0, 12, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  private drawHud(game: Game) {
    const { ctx } = this;
    this.panel(36, 12, 110, 52);
    this.panel(VIEW_W - 146, 12, 110, 52);

    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    this.label("FLOOR", 48, 30);
    this.value(String(game.highest), 48, 56);
    ctx.textAlign = "right";
    this.label("SCORE", VIEW_W - 48, 30);
    this.value(formatNumber(game.score), VIEW_W - 48, 56);

    // The clock: one lap per speed-up, like Icy Tower's.
    const cx = VIEW_W / 2;
    const cy = 38;
    const r = 22;
    ctx.fillStyle = "rgba(5, 7, 13, 0.72)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = game.scrolling ? C.hoodie : C.mist;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const angle = -Math.PI / 2 + (game.levelTime / SPEED_UP_EVERY) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 6), cy + Math.sin(angle) * (r - 6));
    ctx.stroke();
    ctx.textAlign = "center";
    this.label(`SPEED ${game.level + 1}`, cx, cy + r + 14, C.paper);

    // Combo meter down the left wall: drains while a combo runs, with the floor count riding on top of the fill.
    const top = 150;
    const height = 420;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(7, top, 14, height, 7);
    ctx.fill();
    if (game.combo.jumps > 0) {
      const fill = height * Math.max(0, game.combo.time / COMBO_TIME);
      ctx.fillStyle = C.magenta;
      ctx.beginPath();
      ctx.roundRect(7, top + height - fill, 14, fill, 7);
      ctx.fill();

      const pillY = Math.min(top + height - 20, Math.max(top + 20, top + height - fill));
      ctx.fillStyle = "#1a0820";
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(2, pillY - 20, 78, 40, 20);
      ctx.fill();
      ctx.stroke();
      this.neonText(String(game.combo.floors), 41, pillY + 1, 34, C.paper);
      this.neonText("Combo", 46, top - 20, 30, C.paper);
    }
  }

  private drawMusicButton(on: boolean) {
    const { ctx } = this;
    const { x, y, r } = MUSIC_BUTTON;
    ctx.fillStyle = "rgba(5, 7, 13, 0.72)";
    ctx.strokeStyle = on ? C.cyan : "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = on ? C.paper : C.mist;
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 4);
    ctx.lineTo(x - 5, y - 4);
    ctx.lineTo(x + 2, y - 10);
    ctx.lineTo(x + 2, y + 10);
    ctx.lineTo(x - 5, y + 4);
    ctx.lineTo(x - 11, y + 4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = on ? C.paper : C.mist;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (on) {
      ctx.arc(x + 2, y, 7, -0.9, 0.9);
      ctx.moveTo(x + 15, y - 8);
      ctx.arc(x + 2, y, 13, -0.7, 0.7);
    } else {
      ctx.moveTo(x + 8, y - 5);
      ctx.lineTo(x + 16, y + 5);
      ctx.moveTo(x + 16, y - 5);
      ctx.lineTo(x + 8, y + 5);
    }
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  private panel(x: number, y: number, w: number, h: number) {
    const { ctx } = this;
    ctx.fillStyle = "rgba(5, 7, 13, 0.72)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  private label(text: string, x: number, y: number, colour = C.mist) {
    this.ctx.fillStyle = colour;
    this.ctx.font = `700 10px ${UI_FONT}`;
    this.ctx.fillText(text, x, y);
  }

  private value(text: string, x: number, y: number) {
    this.ctx.fillStyle = C.paper;
    this.ctx.font = `700 24px ${UI_FONT}`;
    this.ctx.fillText(text, x, y);
  }

  private drawWorldPopups(popups: Popup[], cam: number) {
    const { ctx } = this;
    for (const popup of popups) {
      if (!popup.at) continue;
      const t = popup.age / popup.life;
      ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
      ctx.font = `700 ${popup.size}px ${UI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.outlined(popup.text, popup.at.x, popup.at.y - cam - t * 36, popup.colour);
      ctx.globalAlpha = 1;
    }
  }

  private drawScreenPopups(popups: Popup[]) {
    const { ctx } = this;
    for (const popup of popups) {
      if (popup.at) continue;
      const t = popup.age / popup.life;
      const size = popup.size * (0.7 + 0.3 * Math.min(1, popup.age / 0.18));
      const y = VIEW_H * (popup.y ?? 0.42) - t * 16;
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      this.neonText(popup.text, VIEW_W / 2, y, size, popup.colour);
      if (popup.detail) {
        ctx.font = `700 18px ${UI_FONT}`;
        this.outlined(popup.detail, VIEW_W / 2, y + size * 0.6 + 8, C.paper);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawTitle(game: Game) {
    const { ctx } = this;
    this.dim(0.6);
    this.neonText("Cashy", VIEW_W / 2, 108, 100, C.paper);
    this.neonText("Tower", VIEW_W / 2, 190, 76, C.paper);
    this.lines(
      ["Climb before the screen catches you.", "Run faster to jump higher. Bounce off walls.", "Skip 2+ floors a jump to chain combos."],
      262,
      C.mist,
    );
    this.lines(["←  →  or  A  D   to move", "Space, W or ↑   to jump", "P or Esc   to pause", "M   music on or off"], 354, C.paper);
    this.drawMenu(game, 510);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (game.best.score > 0) {
      ctx.font = `400 15px ${UI_FONT}`;
      ctx.fillStyle = C.mist;
      ctx.fillText(`Your best: floor ${game.best.floor} · ${formatNumber(game.best.score)} points`, VIEW_W / 2, 472);
    }
    this.drawFooter();
  }

  /** The three choices. The chosen one glows, with a little arrow beside it. */
  private drawMenu(game: Game, top: number, hint = true) {
    const { ctx } = this;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    MENU_ITEMS.forEach((label, i) => {
      const y = top + i * 40;
      const chosen = i === game.menuIndex;
      const text = i === 0 && (game.state === "over" || game.state === "won") ? "Play again" : label;
      ctx.font = chosen ? `700 25px ${UI_FONT}` : `400 20px ${UI_FONT}`;
      if (chosen) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
        this.outlined(text, VIEW_W / 2, y, C.hoodie);
        ctx.globalAlpha = 1;
        const half = ctx.measureText(text).width / 2 + 24;
        ctx.fillStyle = C.hoodie;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(VIEW_W / 2 + side * (half - 8), y - 8);
          ctx.lineTo(VIEW_W / 2 + side * (half + 6), y);
          ctx.lineTo(VIEW_W / 2 + side * (half - 8), y + 8);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = C.mist;
        ctx.fillText(text, VIEW_W / 2, y);
      }
    });
    if (!hint) return;
    ctx.font = `400 13px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.globalAlpha = 0.8;
    ctx.fillText("↑ ↓ to choose  ·  SPACE to pick", VIEW_W / 2, top + MENU_ITEMS.length * 40 + 14);
    ctx.globalAlpha = 1;
  }

  private drawPaused() {
    this.dim(0.6);
    this.neonText("Paused", VIEW_W / 2, 300, 72, C.paper);
    this.lines(["Press P or Esc to carry on"], 372, C.paper);
  }

  private drawGameOver(game: Game) {
    const { ctx } = this;
    this.dim(0.68);
    this.neonText("Cashed out", VIEW_W / 2, 150, 72, C.paper);
    if (game.newBest) this.neonText("New best!", VIEW_W / 2, 214, 36, C.hoodie);

    ctx.font = `700 20px ${UI_FONT}`;
    ctx.fillStyle = C.paper;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    [
      `Floor ${game.highest}`,
      `Score ${formatNumber(game.score)}`,
      `Best combo ${game.bestComboRun} floors`,
      `Cash grabbed ${game.cash}`,
    ].forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 276 + i * 32));

    ctx.font = `400 15px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.fillText(`Your best: floor ${game.best.floor} · ${formatNumber(game.best.score)} points`, VIEW_W / 2, 416);
    if (game.unlockedNow.length > 0) {
      ctx.font = `700 17px ${UI_FONT}`;
      this.outlined(`New starting design unlocked: ${game.unlockedNow.join(", ")}!`, VIEW_W / 2, 448, C.note);
    }
    if (game.overTime >= RESTART_DELAY) this.drawMenu(game, 508);
    this.drawFooter();
  }

  /** The maker's name bottom left, the music credit bottom right beside the mute button. */
  private drawFooter() {
    const { ctx } = this;
    // A soft fade behind the words, so a ledge or the ground line is never underneath them.
    const fade = ctx.createLinearGradient(0, VIEW_H - 90, 0, VIEW_H);
    fade.addColorStop(0, "rgba(5, 7, 13, 0)");
    fade.addColorStop(0.55, "rgba(5, 7, 13, 0.82)");
    fade.addColorStop(1, "rgba(5, 7, 13, 0.92)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, VIEW_H - 90, VIEW_W, 90);
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.mist;
    ctx.globalAlpha = 0.85;
    ctx.font = `400 12px ${UI_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("by Ivan Tornado", 22, MUSIC_BUTTON.y);
    ctx.font = `400 11px ${UI_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`Music: \u201cTechnological Antarctica\u201d by Vaesea`, MUSIC_BUTTON.x - MUSIC_BUTTON.r - 12, MUSIC_BUTTON.y);
    ctx.globalAlpha = 1;
  }

  /** Floor 400: Cashy zooms slowly into a big grin while fire, cash and confetti go off non-stop. */
  private drawWon(game: Game) {
    const { ctx } = this;
    this.dim(0.28);
    // A darker band underneath so the numbers and menu stay readable over the fireworks.
    const fade = Math.min(1, Math.max(0, (game.winTime - 2) / 1.5));
    const band = ctx.createLinearGradient(0, 400, 0, VIEW_H);
    band.addColorStop(0, "rgba(5, 7, 13, 0)");
    band.addColorStop(0.25, `rgba(5, 7, 13, ${0.7 * fade})`);
    band.addColorStop(1, `rgba(5, 7, 13, ${0.85 * fade})`);
    ctx.fillStyle = band;
    ctx.fillRect(0, 400, VIEW_W, VIEW_H - 400);

    const pop = Math.min(1, game.winTime / 0.6);
    ctx.globalAlpha = pop;
    this.neonText("Well done!", VIEW_W / 2, 92, 96 * (0.7 + 0.3 * pop), C.hoodie);
    ctx.globalAlpha = Math.min(1, Math.max(0, (game.winTime - 0.8) / 0.8));
    this.neonText("You completed Cashy Tower!", VIEW_W / 2, 164, 40, C.paper);
    ctx.globalAlpha = fade;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 20px ${UI_FONT}`;
    ctx.fillStyle = C.paper;
    ctx.fillText(`Floor ${game.highest}  ·  Score ${formatNumber(game.score)}`, VIEW_W / 2, 446);
    ctx.font = `400 16px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.fillText(`Best combo ${game.bestComboRun} floors  ·  Cash grabbed ${game.cash}`, VIEW_W / 2, 476);
    if (game.unlockedNow.length > 0) {
      ctx.font = `700 16px ${UI_FONT}`;
      this.outlined(`New starting design unlocked: ${game.unlockedNow.join(", ")}!`, VIEW_W / 2, 508, C.note);
    }
    ctx.globalAlpha = 1;

    if (game.winTime >= WIN_MENU_DELAY) this.drawMenu(game, 548, false);
    this.drawFooter();
  }

  private drawRecords(game: Game) {
    const { ctx } = this;
    this.dim(0.82);
    this.neonText("Records", VIEW_W / 2, 84, 72, C.paper);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 15px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.fillText("Your best five runs, saved on this device", VIEW_W / 2, 152);

    const cols = { rank: 58, floor: 100, points: 176, cash: 276, combo: 342, when: 442 };
    ctx.textAlign = "left";
    ctx.font = `700 11px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.fillText("#", cols.rank, 196);
    ctx.fillText("FLOOR", cols.floor, 196);
    ctx.fillText("POINTS", cols.points, 196);
    ctx.fillText("CASH", cols.cash, 196);
    ctx.fillText("COMBO", cols.combo, 196);
    ctx.fillText("WHEN", cols.when, 196);

    if (game.records.length === 0) {
      ctx.textAlign = "center";
      ctx.font = `400 18px ${UI_FONT}`;
      ctx.fillText("No runs yet. Go climb something.", VIEW_W / 2, 300);
    }
    game.records.forEach((run, i) => {
      const y = 232 + i * 58;
      const latest = run.t === game.lastRunTime;
      ctx.fillStyle = latest ? "rgba(255, 210, 31, 0.14)" : "rgba(255, 255, 255, 0.06)";
      ctx.strokeStyle = latest ? C.hoodie : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = latest ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(44, y - 24, VIEW_W - 88, 48, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textBaseline = "middle";
      ctx.fillStyle = latest ? C.hoodie : C.mist;
      ctx.font = `700 20px ${UI_FONT}`;
      ctx.fillText(String(i + 1), cols.rank, y);
      ctx.fillStyle = C.paper;
      ctx.fillText(String(run.floor), cols.floor, y);
      ctx.fillText(formatNumber(run.score), cols.points, y);
      ctx.fillText(String(run.cash), cols.cash, y);
      ctx.fillText(String(run.combo), cols.combo, y);
      ctx.font = `400 14px ${UI_FONT}`;
      ctx.fillStyle = C.mist;
      const when = new Date(run.t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      ctx.fillText(run.t ? when : "Earlier", cols.when, y);
    });

    ctx.textAlign = "center";
    ctx.font = `400 13px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.fillText("ESC or SPACE to go back", VIEW_W / 2, 640);
  }

  private drawSettings(game: Game) {
    const { ctx } = this;
    this.dim(0.82);
    this.neonText("Settings", VIEW_W / 2, 74, 72, C.paper);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 15px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.fillText("Pick the ledges you start on. Climb higher to unlock more.", VIEW_W / 2, 138);

    DESIGNS.forEach((design, i) => {
      const y = 186 + i * 54;
      const open = game.isUnlocked(i);
      const here = i === game.settingsIndex;
      const picked = i === game.startDesign;
      ctx.fillStyle = here ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.04)";
      ctx.strokeStyle = here ? C.cyan : "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = here ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(40, y - 23, VIEW_W - 80, 46, 12);
      ctx.fill();
      ctx.stroke();

      if (open) {
        design.draw(ctx, 64, y - 6, 150, LEDGE_H, game.time, i + 1);
      } else {
        // Locked: just a grey shape, no name and no hint, so the next one stays a surprise.
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(64, y - 6, 150, LEDGE_H, 5);
        ctx.fill();
        ctx.stroke();
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `700 21px ${UI_FONT}`;
      ctx.fillStyle = open ? C.paper : "rgba(170, 180, 212, 0.45)";
      ctx.fillText(open ? design.name : "???", 246, y);

      ctx.textAlign = "right";
      ctx.font = `700 14px ${UI_FONT}`;
      if (!open) {
        ctx.fillStyle = "rgba(170, 180, 212, 0.55)";
        ctx.fillText("Locked", VIEW_W - 90, y);
        this.drawLock(VIEW_W - 72, y, "rgba(170, 180, 212, 0.55)");
      } else if (picked) {
        ctx.fillStyle = C.hoodie;
        ctx.fillText("Starting here", VIEW_W - 62, y);
      } else if (here) {
        ctx.fillStyle = C.cyan;
        ctx.fillText("SPACE to pick", VIEW_W - 62, y);
      }
    });

    ctx.textAlign = "center";
    ctx.font = `400 13px ${UI_FONT}`;
    ctx.fillStyle = C.mist;
    ctx.fillText(`Highest floor so far: ${game.best.floor}`, VIEW_W / 2, 616);
    ctx.fillText("↑ ↓ to browse  ·  SPACE to pick  ·  ESC to go back", VIEW_W / 2, 640);
  }

  private drawLock(x: number, y: number, colour: string) {
    const { ctx } = this;
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 3, 4.5, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x - 7, y - 3, 14, 11, 2);
    ctx.fill();
  }

  private dim(alpha: number) {
    this.ctx.fillStyle = `rgba(5, 7, 13, ${alpha})`;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private lines(lines: string[], top: number, colour: string) {
    const { ctx } = this;
    ctx.font = `400 16px ${UI_FONT}`;
    ctx.fillStyle = colour;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, top + i * 26));
  }

  /** Text with an ink outline; uses whatever font is already set. */
  private outlined(text: string, x: number, y: number, colour: string) {
    const { ctx } = this;
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
  }

  /** The site's heading look: ink outline, cyan and magenta edges, thickened a touch because Cynatar is thin. */
  private neonText(text: string, x: number, y: number, size: number, fill: string) {
    const { ctx } = this;
    ctx.font = `${size}px ${DISPLAY_FONT}`;
    const width = ctx.measureText(text).width;
    if (width > MAX_TEXT_W) {
      size *= MAX_TEXT_W / width;
      ctx.font = `${size}px ${DISPLAY_FONT}`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = size * 0.16;
    ctx.strokeText(text, x, y);
    const dx = size * 0.03;
    const dy = size * 0.015;
    ctx.fillStyle = C.cyan;
    ctx.fillText(text, x - dx, y + dy);
    ctx.fillStyle = C.magenta;
    ctx.fillText(text, x + dx, y + dy);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.strokeStyle = fill;
    ctx.lineWidth = size * 0.022;
    ctx.strokeText(text, x, y);
  }
}
