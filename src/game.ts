import {
  CAMERA_PUSH_LINE,
  CASH_FLOAT,
  CASH_GRAB_X,
  CASH_GRAB_Y,
  CASH_POINTS,
  COLOURS,
  COMBO_CELEBRATE_EVERY,
  COMBO_MIN_FLOORS,
  COMBO_MIN_JUMPS,
  COMBO_TIME,
  FLOOR_GAP,
  MILESTONE_EVERY,
  PLAYER_H,
  POINTS_PER_FLOOR,
  SCROLL_SPEEDS,
  SCROLL_START_FLOOR,
  SITE_URL,
  SPEED_UP_EVERY,
  VIEW_H,
  VIEW_W,
  WIN_FLOOR,
  WIN_MENU_DELAY,
  WIN_ZOOM,
  WIN_ZOOM_TIME,
} from "./config";
import { DESIGNS, designAt, unlockFloor, type Design } from "./designs";
import type { Input } from "./input";
import { Player, type PlayerEvents } from "./player";
import { addRecord, loadBest, loadDesign, loadRecords, saveBest, saveDesign, type Best, type RunRecord } from "./storage";
import { Tower, floorTop, type Ledge } from "./tower";

export type GameState = "title" | "playing" | "paused" | "over" | "won" | "records" | "settings";


export type Popup = {
  text: string;
  detail?: string;
  /** Pinned to a spot in the tower; otherwise centred on screen at height `y` (share of the screen). */
  at?: { x: number; y: number };
  y?: number;
  age: number;
  life: number;
  size: number;
  colour: string;
};

/** A piece of cash or confetti flying round the screen. Screen space, for show only: it can't be grabbed. */
export type Note = {
  kind: "cash" | "confetti" | "fire";
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  scale: number;
  age: number;
  life: number;
  colour: string;
  w: number;
  h: number;
  round: boolean;
  /** Confetti tumble: the angle it is flipping at. For fire, `w` is the size. */
  flip: number;
  flipSpeed: number;
};

const CONFETTI_COLOURS = [COLOURS.cyan, COLOURS.magenta, COLOURS.hoodie, COLOURS.note, COLOURS.paper, COLOURS.base, "#ff7a45"];

/** One word per 30 floors of combo, each bigger than the last. */
const CELEBRATIONS = ["On fire!", "Unstoppable!", "Legendary!", "Cash god!", "Off the charts!"];
const CELEBRATION_COLOURS = [COLOURS.hoodie, COLOURS.cyan, COLOURS.magenta, COLOURS.note, COLOURS.paper];

/** Biggest first: the first one a combo reaches is the word it gets. */
const COMBO_WORDS: [number, string][] = [
  [100, "Untouchable!"],
  [70, "Legendary!"],
  [50, "Cash storm!"],
  [35, "Big bills!"],
  [25, "Printing!"],
  [15, "Stacked!"],
  [7, "Sweet!"],
  [0, "Nice!"],
];

/** Ground sits near the bottom of the screen at the start. */
const START_CAMERA = -(VIEW_H - 104);
/** Stops a jump key still held from the fall skipping the game over screen. */
export const RESTART_DELAY = 0.8;

export class Game implements PlayerEvents {
  state: GameState = "title";
  tower = new Tower();
  player = new Player();
  /** World y of the top of the screen. Only ever goes up (more negative). */
  camY = START_CAMERA;
  /** Seconds since the page loaded; drives idle animation. */
  time = 0;
  scrolling = false;
  level = 0;
  levelTime = 0;
  highest = 0;
  bonus = 0;
  cash = 0;
  combo = { floors: 0, jumps: 0, time: 0 };
  bestComboRun = 0;
  /** How many combos (2+ jumps in a row) this run has banked. */
  combosRun = 0;
  popups: Popup[] = [];
  notes: Note[] = [];
  best: Best = loadBest();
  newBest = false;
  overTime = 0;
  menuIndex = 0;
  /** Seconds since Cashy completed the tower. */
  winTime = 0;
  private winEmbers = 0;
  private winBooms = 0;
  private winRain = 0;
  /** Which design the cursor is on in Settings. */
  settingsIndex = 0;
  records: RunRecord[] = loadRecords();
  /** When the run just finished ended, so Records can highlight it. */
  lastRunTime = 0;
  /** Names of any starting designs the last run unlocked. */
  unlockedNow: string[] = [];
  startDesign = 0;
  /** Where Records and Settings return to. */
  private shareRequested = false;
  private back: "title" | "over" | "won" = "title";
  private nextMilestone = MILESTONE_EVERY;

  constructor(private input: Input) {
    this.startDesign = Math.min(loadDesign(), this.unlockedCount() - 1);
  }

  /** How many starting designs this player has earned. */
  unlockedCount() {
    return Math.min(DESIGNS.length, Math.floor(this.best.floor / unlockFloor(1)) + 1);
  }

  isUnlocked(design: number) {
    return design < this.unlockedCount();
  }

  /** The look of the ledges at a floor, given where this run started. */
  designAt(floor: number): Design {
    return designAt(this.startDesign, floor);
  }

  get score() {
    return this.highest * POINTS_PER_FLOOR + this.bonus;
  }

  update(dt: number) {
    this.time += dt;
    const pausePressed = this.input.takePause();
    if (this.state !== "paused") this.moveNotes(dt);

    switch (this.state) {
      case "title":
        this.updateMenu();
        break;
      case "over":
        this.overTime += dt;
        this.updateMenu();
        break;
      case "won":
        this.winTime += dt;
        this.celebrateForever(dt);
        this.updateMenu();
        break;
      case "records":
        this.input.takeMove();
        if (pausePressed || this.input.takeSelect()) this.state = this.back;
        break;
      case "settings":
        this.updateSettings(pausePressed);
        break;
      case "paused":
        if (pausePressed || this.input.takeSelect()) this.state = "playing";
        this.input.takeJump();
        return;
      case "playing":
        // Menu presses made during play must not be waiting for the next menu.
        this.input.takeSelect();
        this.input.takeMove();
        if (pausePressed) {
          this.state = "paused";
          return;
        }
        this.step(dt);
        break;
    }

    // Space pressed in a menu must not become a jump on the first frame of the next run.
    if (this.state !== "playing") this.input.takeJump();
    this.popups = this.popups.filter((popup) => (popup.age += dt) < popup.life);
  }

  /** The buttons on the current screen. Sharing only makes sense once a run has ended. */
  get menuItems(): string[] {
    return this.state === "over" || this.state === "won"
      ? ["Play again", "Share on X", "Check records", "Settings"]
      : ["Play", "Check records", "Settings"];
  }

  /** The pre-written post. Combos are left out when there were none. */
  /** The pre-written post (Base City brief, update 2). Well under X's 280 characters. */
  get shareText() {
    const floors = `${this.highest} floor${this.highest === 1 ? "" : "s"}`;
    return `I climbed ${floors} in Cashy Tower 🏙️\n\nBuilt on @base 🔵\nCash in. MSTR out. @feeldotcash\n\n${SITE_URL}/arcade/`;
  }

  /** Hands over the X link once after Share on X is picked, for the page to open. */
  takeShare(): string | null {
    if (!this.shareRequested) return null;
    this.shareRequested = false;
    return `https://x.com/intent/post?text=${encodeURIComponent(this.shareText)}`;
  }

  private updateMenu() {
    const items = this.menuItems;
    const move = this.input.takeMove();
    if (move) this.menuIndex = (this.menuIndex + move + items.length) % items.length;
    if (!this.input.takeSelect()) return;
    // A jump key still held from the fall must not skip the game over screen, and the ending gets its moment.
    if (this.state === "over" && this.overTime < RESTART_DELAY) return;
    if (this.state === "won" && this.winTime < WIN_MENU_DELAY) return;

    const choice = items[this.menuIndex];
    if (choice.startsWith("Play")) this.start();
    else if (choice === "Share on X") this.shareRequested = true;
    else if (choice === "Check records") this.open("records");
    else {
      this.settingsIndex = this.startDesign;
      this.open("settings");
    }
  }

  private open(screen: "records" | "settings") {
    this.back = this.state === "over" || this.state === "won" ? this.state : "title";
    this.state = screen;
  }

  private updateSettings(pausePressed: boolean) {
    const move = this.input.takeMove();
    if (move) this.settingsIndex = (this.settingsIndex + move + DESIGNS.length) % DESIGNS.length;
    if (this.input.takeSelect() && this.isUnlocked(this.settingsIndex)) {
      this.startDesign = this.settingsIndex;
      saveDesign(this.startDesign);
    }
    if (pausePressed) this.state = this.back;
  }

  pause() {
    if (this.state === "playing") this.state = "paused";
  }

  private start() {
    this.tower = new Tower();
    this.player = new Player();
    this.camY = START_CAMERA;
    this.scrolling = false;
    this.level = 0;
    this.levelTime = 0;
    this.highest = 0;
    this.bonus = 0;
    this.cash = 0;
    this.combo = { floors: 0, jumps: 0, time: 0 };
    this.bestComboRun = 0;
    this.combosRun = 0;
    this.popups = [];
    this.notes = [];
    this.newBest = false;
    this.winTime = 0;
    this.nextMilestone = MILESTONE_EVERY;
    this.state = "playing";
  }

  private step(dt: number) {
    const player = this.player;
    player.update(dt, this.input, this.tower, this);
    // Landing on the top floor ends the run in the ending, so nothing else this step matters.
    if (this.state !== "playing") return;
    this.collectCash();

    if (this.combo.jumps > 0) {
      this.combo.time -= dt;
      if (this.combo.time <= 0) this.endCombo();
    }

    this.moveCamera(dt);

    const reached = Math.floor(-player.bottom / FLOOR_GAP);
    while (reached >= this.nextMilestone) {
      this.shout(`Floor ${this.nextMilestone}`, this.designAt(this.nextMilestone).colour, 0.18);
      this.celebrate(70, player.centerX, player.y - this.camY);
      this.nextMilestone += MILESTONE_EVERY;
    }

    // Off the bottom of the screen is the end, wherever the floors are.
    if (player.y + PLAYER_H / 2 - this.camY > VIEW_H) this.gameOver();
  }

  private moveCamera(dt: number) {
    if (!this.scrolling && this.highest >= SCROLL_START_FLOOR) this.scrolling = true;

    if (this.scrolling) {
      this.levelTime += dt;
      if (this.levelTime >= SPEED_UP_EVERY) {
        this.levelTime -= SPEED_UP_EVERY;
        if (this.level < SCROLL_SPEEDS.length - 1) {
          this.level++;
          this.shout("Hurry up!", COLOURS.hoodie, 0.27);
        }
      }
      this.camY -= SCROLL_SPEEDS[this.level] * dt;
    }

    const push = this.player.y - VIEW_H * CAMERA_PUSH_LINE;
    if (push < this.camY) this.camY = push;
  }

  private collectCash() {
    const player = this.player;
    const near = Math.floor(-player.bottom / FLOOR_GAP);
    // Passing through the note is enough, however fast Cashy is going.
    for (let i = Math.max(0, near - 2); i <= near + 2; i++) {
      const cash = this.tower.get(i).cash;
      if (!cash || cash.taken) continue;
      const cy = floorTop(i) - CASH_FLOAT;
      if (Math.abs(player.centerX - cash.x) < CASH_GRAB_X && player.y < cy + CASH_GRAB_Y && player.bottom > cy - CASH_GRAB_Y) {
        cash.taken = true;
        this.cash++;
        this.bonus += CASH_POINTS;
        this.popups.push({ text: `+${CASH_POINTS}`, at: { x: cash.x, y: cy }, age: 0, life: 0.9, size: 22, colour: COLOURS.note });
      }
    }
  }

  onLand(floor: number) {
    const jumped = floor - this.player.takeoffFloor;
    if (jumped >= COMBO_MIN_FLOORS) {
      const before = Math.floor(this.combo.floors / COMBO_CELEBRATE_EVERY);
      this.combo.floors += jumped;
      this.combo.jumps++;
      this.combo.time = COMBO_TIME;
      const tier = Math.floor(this.combo.floors / COMBO_CELEBRATE_EVERY);
      if (tier > before) this.celebrateCombo(tier);
    } else if (jumped > 0 && this.combo.jumps > 0) {
      // Only a short hop up (one floor) breaks the chain. Landing back on the same floor, or lower,
      // leaves the combo alone: the timer keeps running and the next big jump can still add to it.
      this.endCombo();
    }
    if (floor > this.highest) this.highest = floor;
    if (floor >= WIN_FLOOR && this.state === "playing") this.win();
  }

  onTrampoline(ledge: Ledge) {
    ledge.trampoline!.bouncedAt = this.time;
  }

  private endCombo() {
    const { floors, jumps } = this.combo;
    this.combo = { floors: 0, jumps: 0, time: 0 };
    if (jumps < COMBO_MIN_JUMPS) return;
    this.combosRun++;

    const points = floors * floors;
    this.bonus += points;
    this.bestComboRun = Math.max(this.bestComboRun, floors);
    const word = COMBO_WORDS.find(([min]) => floors >= min)![1];
    this.shout(word, COLOURS.paper, 0.44, `${floors} floors  +${points.toLocaleString("en-GB")}`);
  }

  private shout(text: string, colour: string, y: number, detail?: string, size = 54, life = 1.6) {
    // One message per slot, so a new combo replaces the last one instead of piling up.
    this.popups = this.popups.filter((popup) => popup.at || popup.y !== y);
    this.popups.push({ text, detail, y, age: 0, life, size, colour });
  }

  /** Every 30 floors of combo: a louder word each time, and a burst of cash. */
  private celebrateCombo(tier: number) {
    const i = Math.min(tier, CELEBRATIONS.length) - 1;
    const size = Math.min(150, 62 + (tier - 1) * 24);
    const floors = tier * COMBO_CELEBRATE_EVERY;
    this.shout(CELEBRATIONS[i], CELEBRATION_COLOURS[i], 0.36, `${floors} floor combo`, size, 2.4);
    this.confetti(Math.min(300, 110 + tier * 50));
  }

  /** Party poppers: two cannons fire from the bottom corners, and more drifts down from the top. */
  private confetti(count: number, cannons = true) {
    const fromCannons = cannons ? Math.round(count * 0.65) : 0;
    for (let i = 0; i < count; i++) {
      const fromCannon = i < fromCannons;
      const left = i % 2 === 0;
      // Cannons aim up and inwards with a wide fan; the rest starts above the screen.
      const angle = (left ? -1.05 : -Math.PI + 1.05) + (Math.random() - 0.5) * 0.9;
      const speed = 700 + Math.random() * 900;
      this.notes.push(
        this.confettiPiece(
          fromCannon ? (left ? 30 : VIEW_W - 30) : Math.random() * VIEW_W,
          fromCannon ? VIEW_H - 20 : -20 - Math.random() * 200,
          fromCannon ? Math.cos(angle) * speed : (Math.random() - 0.5) * 160,
          fromCannon ? Math.sin(angle) * speed : 40 + Math.random() * 120,
          fromCannon ? 3.2 + Math.random() * 1.6 : 4.2 + Math.random() * 1.2,
        ),
      );
    }
  }

  private confettiPiece(x: number, y: number, vx: number, vy: number, life: number): Note {
    return {
      kind: "confetti",
      x,
      y,
      vx,
      vy,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
      scale: 1,
      age: 0,
      life,
      colour: CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
      w: 9 + Math.random() * 9,
      h: 5 + Math.random() * 5,
      round: Math.random() < 0.22,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 6 + Math.random() * 10,
    };
  }

  /** Cash bursts out of a point, then more rains from the top. */
  private celebrate(count: number, x: number, y: number, rainOnly = false) {
    const burst = rainOnly ? 0 : Math.round(count * 0.6);
    for (let i = 0; i < count; i++) {
      const raining = i >= burst;
      const angle = Math.random() * Math.PI * 2;
      const speed = 260 + Math.random() * 520;
      this.notes.push({
        kind: "cash",
        colour: COLOURS.note,
        w: 0,
        h: 0,
        round: false,
        flip: 0,
        flipSpeed: 0,
        x: raining ? Math.random() * VIEW_W : x,
        y: raining ? -30 - Math.random() * 160 : y,
        vx: raining ? (Math.random() - 0.5) * 140 : Math.cos(angle) * speed,
        vy: raining ? 80 + Math.random() * 200 : Math.sin(angle) * speed - 340,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 9,
        scale: 1.1 + Math.random() * 0.9,
        age: 0,
        life: raining ? 3.4 : 2.2 + Math.random() * 0.8,
      });
    }
  }

  private moveNotes(dt: number) {
    for (const note of this.notes) {
      note.age += dt;
      if (note.kind === "fire") {
        // Sparks: air slows them, gravity pulls firework sparks down, and embers (negative scale) float up.
        note.vx *= 1 - Math.min(1, dt * 1.4);
        note.vy = note.vy * (1 - Math.min(1, dt * 1.1)) + 360 * note.scale * dt;
      } else if (note.kind === "confetti") {
        // Paper: air drags it to a slow flutter, so it hangs around instead of dropping like cash.
        const drag = 1 - Math.min(1, dt * 1.9);
        note.vx *= drag;
        note.vy = note.vy * drag + 330 * dt;
        note.flip += note.flipSpeed * dt;
      } else {
        note.vy += 900 * dt;
        note.vx *= 1 - Math.min(1, dt * 0.8);
      }
      note.x += note.vx * dt;
      note.y += note.vy * dt;
      note.rot += note.spin * dt;
    }
    this.notes = this.notes.filter((note) => note.age < note.life && note.y < VIEW_H + 40 && note.y > -300);
  }

  private gameOver() {
    this.finish("over");
  }

  /** Cashy lands on the top floor: the run ends in the celebration instead of a fall. */
  private win() {
    this.player.vx = 0;
    this.player.facing = 1;
    this.winTime = 0;
    this.winEmbers = 0;
    this.winBooms = 0;
    this.winRain = 0;
    this.finish("won");
  }

  /** How far into the slow zoom on Cashy the ending is, 0 to 1, easing out. */
  get winZoom() {
    const t = Math.min(1, this.winTime / WIN_ZOOM_TIME);
    return 1 - (1 - t) ** 3;
  }

  get zoomLevel() {
    return 1 + (WIN_ZOOM - 1) * this.winZoom;
  }

  private finish(ending: "over" | "won") {
    if (this.combo.jumps > 0) this.endCombo();
    this.state = ending;
    this.menuIndex = 0;
    this.overTime = 0;
    this.newBest = this.score > this.best.score;

    // Starting designs unlock by the highest floor ever reached, so work out what this run added.
    const before = this.unlockedCount();
    this.best = {
      score: Math.max(this.best.score, this.score),
      floor: Math.max(this.best.floor, this.highest),
      combo: Math.max(this.best.combo, this.bestComboRun),
    };
    saveBest(this.best);
    this.unlockedNow = DESIGNS.slice(before, this.unlockedCount()).map((design) => design.name);

    if (this.score > 0) {
      this.lastRunTime = Date.now();
      this.records = addRecord(this.records, { score: this.score, floor: this.highest, cash: this.cash, combo: this.bestComboRun, t: this.lastRunTime });
    }
  }

  /** The ending never stops: embers rise, cash and confetti rain, and fireworks go off every half second. */
  private celebrateForever(dt: number) {
    this.winEmbers += dt;
    this.winBooms += dt;
    this.winRain += dt;
    while (this.winEmbers >= 0.03) {
      this.winEmbers -= 0.03;
      this.ember(Math.random() * VIEW_W, VIEW_H + 10, 160 + Math.random() * 260, true);
    }
    while (this.winRain >= 0.14) {
      this.winRain -= 0.14;
      this.confetti(10, false);
      this.celebrate(2, 0, 0, true);
    }
    while (this.winBooms >= 0.45) {
      this.winBooms -= 0.45;
      this.explode(70 + Math.random() * (VIEW_W - 140), 80 + Math.random() * (VIEW_H * 0.5));
    }
    // Keep it busy but not heavy: the oldest pieces go first.
    if (this.notes.length > 900) this.notes.splice(0, this.notes.length - 900);
  }

  /** A firework: sparks, confetti and a few notes flying out of one point. */
  private explode(x: number, y: number) {
    for (let i = 0; i < 38; i++) this.ember(x, y, 160 + Math.random() * 380, false, Math.random() * Math.PI * 2);
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 220 + Math.random() * 380;
      this.notes.push(this.confettiPiece(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.6 + Math.random() * 1.2));
    }
    this.celebrate(6, x, y);
  }

  /** One flame spark. Rising embers float up; firework sparks arc out and fall. */
  private ember(x: number, y: number, speed: number, rising: boolean, angle = 0) {
    const a = rising ? -Math.PI / 2 + (Math.random() - 0.5) * 0.6 : angle;
    this.notes.push({
      kind: "fire",
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: 0,
      spin: 0,
      scale: rising ? -0.5 : 1,
      age: 0,
      life: rising ? 1.6 + Math.random() * 1.4 : 0.9 + Math.random() * 0.9,
      colour: "",
      w: 2.5 + Math.random() * 3.5,
      h: 0,
      round: true,
      flip: 0,
      flipSpeed: 0,
    });
  }
}
