import "./style.css";
import { loadAssets } from "./assets";
import { MUSIC_BUTTON, VIEW_H, VIEW_W } from "./config";
import { Game } from "./game";
import { Input } from "./input";
import { Music } from "./music";
import { Renderer } from "./render";

/** Physics runs at a fixed 120 steps a second, whatever the screen's refresh rate. */
const STEP = 1 / 120;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;

try {
  const assets = await loadAssets();
  const input = new Input(window);
  const game = new Game(input);
  const renderer = new Renderer(ctx, assets);
  const music = new Music();

  const fit = () => {
    const scale = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    canvas.style.width = `${VIEW_W * scale}px`;
    canvas.style.height = `${VIEW_H * scale}px`;
    canvas.width = Math.round(VIEW_W * scale * pixelRatio);
    canvas.height = Math.round(VIEW_H * scale * pixelRatio);
    renderer.setScale(canvas.width / VIEW_W);
  };
  fit();
  addEventListener("resize", fit);
  addEventListener("blur", () => game.pause());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) game.pause();
    music.setHidden(document.hidden);
  });

  // The first key press or click is what lets the browser play sound.
  addEventListener("keydown", () => music.arm());
  canvas.addEventListener("pointerdown", (event) => {
    music.arm();
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) * VIEW_W) / box.width;
    const y = ((event.clientY - box.top) * VIEW_H) / box.height;
    if (Math.hypot(x - MUSIC_BUTTON.x, y - MUSIC_BUTTON.y) <= MUSIC_BUTTON.r + 6) music.toggle();
  });

  let last = performance.now();
  let carry = 0;
  const frame = (now: number) => {
    carry += Math.min(0.1, (now - last) / 1000);
    last = now;
    if (input.takeMusic()) music.toggle();
    while (carry >= STEP) {
      game.update(STEP);
      carry -= STEP;
    }
    renderer.draw(game, music.enabled);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (import.meta.env.DEV) Object.assign(window, { game, renderer, music });
} catch (error) {
  console.error(error);
  const message = document.createElement("p");
  message.className = "load-error";
  message.textContent = "Cashy Tower couldn't load. Refresh to try again.";
  canvas.replaceWith(message);
}
