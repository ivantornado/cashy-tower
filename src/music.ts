import { MUSIC_VOLUME } from "./config";

const KEY = "cashy-tower:music";

function loadSetting() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** One looping track. Browsers only allow sound after a key press or click, so nothing starts until arm(). */
export class Music {
  enabled = loadSetting();
  private ctx?: AudioContext;
  private gain?: GainNode;
  private buffer?: AudioBuffer;
  private source?: AudioBufferSourceNode;
  private loading?: Promise<void>;

  /** Call from any key press or click. Safe to call again and again. */
  arm() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    this.loading ??= this.load();
    this.sync();
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(KEY, this.enabled ? "on" : "off");
    } catch {
      // Blocked storage: the choice lasts this visit only.
    }
    this.arm();
  }

  /** Silence while the tab is hidden, back again when it returns. */
  setHidden(hidden: boolean) {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }

  private async load() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/antarctica.m4a`);
      this.buffer = await this.ctx!.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      console.warn("Music couldn't load", error);
    }
    this.sync();
  }

  private sync() {
    const { ctx, gain } = this;
    if (!ctx || !gain) return;
    // Fade rather than cut, so toggling never clicks. The track keeps running while muted.
    gain.gain.setTargetAtTime(this.enabled ? MUSIC_VOLUME : 0, ctx.currentTime, 0.12);
    if (this.buffer && !this.source) {
      this.source = ctx.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = true;
      this.source.connect(gain);
      this.source.start();
    }
  }
}
