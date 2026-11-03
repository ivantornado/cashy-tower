import {
  AIR_ACCEL,
  AIR_DRAG,
  COYOTE_TIME,
  DOUBLE_SPIN_JUMP,
  FLIP_CROUCH,
  FLOOR_GAP,
  GRAVITY,
  GROUND_FRICTION,
  INNER_L,
  INNER_R,
  JUMP_BASE,
  JUMP_BUFFER,
  JUMP_RUN_GAIN,
  LAND_CROUCH,
  MAX_FALL,
  MAX_RUN,
  PLAYER_H,
  PLAYER_W,
  RUN_ACCEL,
  SPIN_JUMP,
  TRAMPOLINE_JUMP,
  WALL_BOUNCE,
} from "./config";
import type { Input } from "./input";
import { floorTop, type Ledge, type Tower } from "./tower";

export interface PlayerEvents {
  onLand(floor: number): void;
  onTrampoline(ledge: Ledge): void;
}

function approach(value: number, target: number, step: number) {
  return value > target ? Math.max(target, value - step) : Math.min(target, value + step);
}

export class Player {
  x = (INNER_L + INNER_R - PLAYER_W) / 2;
  y = -PLAYER_H;
  vx = 0;
  vy = 0;
  grounded = true;
  facing = 1;
  /** The floor Cashy stands on, or last stood on. */
  floor = 0;
  /** Where the current jump started; combos count floors from here. */
  takeoffFloor = 0;
  /** 1 is normal; above stretches tall, below squashes flat. */
  squash = 1;
  /** Radians of the current spin. */
  spin = 0;
  /** A small hop, or a flip that starts crouched and opens up. */
  jumpKind: "hop" | "flip" = "hop";
  private airTime = 0;
  private landCrouch = 0;
  private spinTime = 0;
  private spinDuration = 0;
  private spinTurns = 1;
  private coyote = 0;
  private jumpBuffer = 0;

  get centerX() {
    return this.x + PLAYER_W / 2;
  }

  get bottom() {
    return this.y + PLAYER_H;
  }

  /** Crouched on and just after a ledge, through a small hop, and for the first moment of a flip. */
  get crouched() {
    if (this.grounded) return this.landCrouch > 0;
    return this.jumpKind === "hop" || this.airTime < FLIP_CROUCH;
  }

  update(dt: number, input: Input, tower: Tower, events: PlayerEvents) {
    this.steer(dt, input.direction);
    this.moveSideways(dt);

    this.landCrouch -= dt;
    if (!this.grounded) this.airTime += dt;

    if (this.grounded && !this.standsOn(tower.get(this.floor))) {
      this.grounded = false;
      this.takeoffFloor = this.floor;
      this.jumpKind = "hop";
      this.airTime = 0;
    }

    // Holding jump keeps bouncing the moment Cashy lands, like Icy Tower.
    this.coyote = this.grounded ? COYOTE_TIME : this.coyote - dt;
    this.jumpBuffer = input.takeJump() ? JUMP_BUFFER : this.jumpBuffer - dt;
    if ((this.jumpBuffer > 0 || input.jump) && this.coyote > 0) this.launch(JUMP_BASE + JUMP_RUN_GAIN * Math.min(1, Math.abs(this.vx) / MAX_RUN));

    if (!this.grounded) this.fall(dt, tower, events);

    this.squash += (1 - this.squash) * Math.min(1, dt * 12);
    if (this.spinDuration > 0) {
      this.spinTime += dt;
      this.spin = Math.min(1, this.spinTime / this.spinDuration) * Math.PI * 2 * this.spinTurns;
      if (this.spinTime >= this.spinDuration) this.stopSpin();
    }
  }

  private steer(dt: number, direction: number) {
    if (direction !== 0) {
      this.facing = direction;
      const turning = this.vx * direction < 0;
      const accel = this.grounded ? RUN_ACCEL * (turning ? 2 : 1) : AIR_ACCEL;
      this.vx += direction * accel * dt;
    } else {
      this.vx = approach(this.vx, 0, (this.grounded ? GROUND_FRICTION : AIR_DRAG) * dt);
    }
    this.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, this.vx));
  }

  private moveSideways(dt: number) {
    this.x += this.vx * dt;
    if (this.x < INNER_L) {
      this.x = INNER_L;
      this.hitWall();
    } else if (this.x + PLAYER_W > INNER_R) {
      this.x = INNER_R - PLAYER_W;
      this.hitWall();
    }
  }

  /** Mid-air walls bounce Cashy back with most of his speed, which is how combos get built. */
  private hitWall() {
    if (this.grounded || Math.abs(this.vx) < 80) {
      this.vx = 0;
      return;
    }
    this.vx = -this.vx * WALL_BOUNCE;
    this.facing = Math.sign(this.vx);
  }

  private launch(speed: number) {
    this.vy = -speed;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.takeoffFloor = this.floor;
    this.squash = 1.18;
    this.airTime = 0;
    this.jumpKind = speed >= SPIN_JUMP ? "flip" : "hop";
    if (this.jumpKind === "flip") {
      this.spinTime = 0;
      this.spinTurns = speed >= DOUBLE_SPIN_JUMP ? 2 : 1;
      this.spinDuration = ((2 * speed) / GRAVITY) * 0.85;
    }
  }

  private fall(dt: number, tower: Tower, events: PlayerEvents) {
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    const before = this.bottom;
    this.y += this.vy * dt;
    if (this.vy <= 0) return;

    // Ledges are one-way: only catch Cashy when his feet cross a top edge on the way down.
    const after = this.bottom;
    const lowest = Math.max(0, Math.ceil(-after / FLOOR_GAP));
    for (let i = Math.floor(-before / FLOOR_GAP); i >= lowest; i--) {
      const ledge = tower.get(i);
      if (this.standsOn(ledge)) {
        this.land(ledge, events);
        return;
      }
    }
  }

  private land(ledge: Ledge, events: PlayerEvents) {
    this.y = floorTop(ledge.index) - PLAYER_H;
    this.vy = 0;
    this.grounded = true;
    this.floor = ledge.index;
    this.squash = 0.78;
    this.landCrouch = LAND_CROUCH;
    this.airTime = 0;
    this.stopSpin();
    events.onLand(ledge.index);

    if (ledge.trampoline) {
      this.launch(TRAMPOLINE_JUMP);
      events.onTrampoline(ledge);
    }
  }

  private standsOn(ledge: Ledge) {
    return this.x + PLAYER_W - 5 > ledge.x && this.x + 5 < ledge.x + ledge.w;
  }

  private stopSpin() {
    this.spin = 0;
    this.spinDuration = 0;
  }
}
