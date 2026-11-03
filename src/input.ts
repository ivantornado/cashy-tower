const LEFT = ["ArrowLeft", "KeyA"];
const RIGHT = ["ArrowRight", "KeyD"];
const JUMP = ["Space", "KeyW", "ArrowUp"];
const SELECT = ["Space", "Enter"];
const UP = ["ArrowUp", "KeyW"];
const DOWN = ["ArrowDown", "KeyS"];
const PAUSE = ["KeyP", "Escape"];
const MUSIC = ["KeyM"];
const GAME_KEYS = new Set([...LEFT, ...RIGHT, ...JUMP, ...DOWN, "Enter"]);

/** Keyboard for now. Phone tilt and tap will feed the same controls later. */
export class Input {
  private held = new Set<string>();
  private jumpPressed = false;
  private selectPressed = false;
  private move = 0;
  private pausePressed = false;
  private musicPressed = false;

  constructor(target: Window) {
    target.addEventListener("keydown", (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.held.add(event.code);
      if (JUMP.includes(event.code)) this.jumpPressed = true;
      if (SELECT.includes(event.code)) this.selectPressed = true;
      if (UP.includes(event.code)) this.move = -1;
      if (DOWN.includes(event.code)) this.move = 1;
      if (PAUSE.includes(event.code)) this.pausePressed = true;
      if (MUSIC.includes(event.code)) this.musicPressed = true;
    });
    target.addEventListener("keyup", (event) => this.held.delete(event.code));
    target.addEventListener("blur", () => this.held.clear());
  }

  /** -1 left, 1 right, 0 neither or both. */
  get direction() {
    return (RIGHT.some((key) => this.held.has(key)) ? 1 : 0) - (LEFT.some((key) => this.held.has(key)) ? 1 : 0);
  }

  get jump() {
    return JUMP.some((key) => this.held.has(key));
  }

  /** True once per press. */
  takeJump() {
    const pressed = this.jumpPressed;
    this.jumpPressed = false;
    return pressed;
  }

  /** Space or Enter, for menus. */
  takeSelect() {
    const pressed = this.selectPressed;
    this.selectPressed = false;
    return pressed;
  }

  /** -1 for up, 1 for down, 0 for neither, for menus. */
  takeMove() {
    const move = this.move;
    this.move = 0;
    return move;
  }

  takeMusic() {
    const pressed = this.musicPressed;
    this.musicPressed = false;
    return pressed;
  }

  takePause() {
    const pressed = this.pausePressed;
    this.pausePressed = false;
    return pressed;
  }
}
