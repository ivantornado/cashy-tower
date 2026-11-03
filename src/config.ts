// Every number that shapes how the game feels lives here, so tuning never means hunting through code.

/** [floor, value] points with straight lines between them, flat past both ends. */
export type Curve = readonly (readonly [number, number])[];

// Screen. Everything is drawn in these units and scaled to fit the window.
/** 650px between the walls. */
export const VIEW_W = 706;
export const VIEW_H = 720;
export const WALL_W = 28;
export const INNER_L = WALL_W;
export const INNER_R = VIEW_W - WALL_W;
export const INNER_W = INNER_R - INNER_L;

// The tower. Floor n's top edge sits at world y = -n * FLOOR_GAP; up is negative.
export const FLOOR_GAP = 88;
export const LEDGE_H = 16;
export const MILESTONE_EVERY = 50;
export const LABEL_EVERY = 10;

/** Ledges narrow as you climb. */
export const LEDGE_WIDTH: Curve = [[0, 200], [100, 150], [200, 112], [300, 80], [400, 62]];
export const LEDGE_WIDTH_JITTER = 0.18;
/** How far sideways the next ledge's middle can be from the last one's, so every floor stays reachable. */
export const LEDGE_REACH = 440;
/** Chance a whole ledge is a trampoline: about 16 in the first 400 floors, mostly low down. */
export const TRAMPOLINE_CHANCE: Curve = [[0, 0.1], [50, 0.085], [100, 0.06], [200, 0.03], [300, 0.015], [400, 0.007]];
/** Clears about 11.5 floors. */
export const TRAMPOLINE_JUMP = 2205;
/** Cash is rare on purpose: roughly one note every 30 to 40 floors. */
export const CASH_CHANCE = 0.05;
export const CASH_MIN_GAP = 12;
export const CASH_MIN_FLOOR = 6;
export const CASH_FLOAT = 30;
/** Cashy only has to pass near a note to grab it. */
export const CASH_GRAB_X = 44;
export const CASH_GRAB_Y = 26;

// Cashy
export const PLAYER_W = 30;
export const PLAYER_H = 62;
export const GRAVITY = 2400;
export const RUN_ACCEL = 1660;
export const AIR_ACCEL = 1460;
export const GROUND_FRICTION = 2430;
export const AIR_DRAG = 140;
export const MAX_RUN = 720;
/** A standing jump clears about 1.4 floors; a 2-floor combo jump needs roughly a quarter to a third of top speed. */
export const JUMP_BASE = 770;
/** Extra jump speed at full run: flat out clears about 4.6 floors. It scales with the share of top speed, so running faster never means jumping higher. */
export const JUMP_RUN_GAIN = 630;
/** Share of sideways speed kept when bouncing off a wall in mid-air. */
export const WALL_BOUNCE = 0.9;
export const MAX_FALL = 1500;
/** Grace after running off a ledge. */
export const COYOTE_TIME = 0.08;
/** A jump pressed this soon before landing still counts. */
export const JUMP_BUFFER = 0.12;
/** Jumps at least this fast (about 3 floors) make Cashy flip. */
export const SPIN_JUMP = 1150;
/** Trampoline-sized jumps flip twice. */
export const DOUBLE_SPIN_JUMP = 2000;
/** Flips start crouched for this long, then he opens up. */
export const FLIP_CROUCH = 0.14;
/** He crouches for this long after touching a ledge. */
export const LAND_CROUCH = 0.12;

// Combos: chain jumps of 2+ floors each before the timer runs out. Worth floors squared.
export const COMBO_MIN_FLOORS = 2;
export const COMBO_MIN_JUMPS = 2;
export const COMBO_TIME = 3;
/** A big celebration each time a combo passes a multiple of this many floors. */
export const COMBO_CELEBRATE_EVERY = 30;

// The ending: landing on this floor completes the tower.
export const WIN_FLOOR = 400;
/** Seconds of celebration before the menu appears. */
export const WIN_MENU_DELAY = 7;
export const WIN_ZOOM = 2.2;
/** Seconds the slow zoom on Cashy takes. */
export const WIN_ZOOM_TIME = 12;

// Score
export const POINTS_PER_FLOOR = 10;
export const CASH_POINTS = 250;

// The rising screen. It starts once you reach SCROLL_START_FLOOR, then speeds up on a clock.
export const SCROLL_START_FLOOR = 5;
export const SPEED_UP_EVERY = 30;
/** Screen speed in px/s at each level. Tuned so most runs end between floors 50 and 300. */
export const SCROLL_SPEEDS = [34, 58, 84, 110, 138, 168, 200, 236, 280, 330];
/** Cashy above this share of the screen pushes the view up. */
export const CAMERA_PUSH_LINE = 0.38;

/** The speaker button, bottom right. */
export const MUSIC_BUTTON = { x: VIEW_W - 50, y: VIEW_H - 50, r: 24 };
export const MUSIC_VOLUME = 0.6;

export const COLOURS = {
  ink: "#05070d",
  wall: "#0d1433",
  wallLine: "#1b2856",
  ledge: "#1c2a62",
  paper: "#f2f4f8",
  mist: "#aab4d4",
  cyan: "#27e7ff",
  magenta: "#ff2bd6",
  note: "#a9dd8c",
  hoodie: "#ffd21f",
  base: "#0052ff",
};
