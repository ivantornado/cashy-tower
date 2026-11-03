export type Assets = {
  standing: HTMLImageElement;
  crouching: HTMLImageElement;
};

export const DISPLAY_FONT = "Cynatar";
export const UI_FONT = "'Noto Sans CT', system-ui, sans-serif";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

async function loadFont(family: string, file: string, weight = "400") {
  const face = new FontFace(family, `url(${import.meta.env.BASE_URL}fonts/${file})`, { weight });
  document.fonts.add(await face.load());
}

export async function loadAssets(): Promise<Assets> {
  const art = `${import.meta.env.BASE_URL}art/`;
  // TODO: final art. Cashy cutouts from the site, with its neon treatment baked in.
  const [standing, crouching] = await Promise.all([
    loadImage(`${art}cashy-standing.webp`),
    loadImage(`${art}cashy-crouching.webp`),
    loadFont(DISPLAY_FONT, "Cynatar.woff2"),
    loadFont("Noto Sans CT", "NotoSans-Regular.woff2"),
    loadFont("Noto Sans CT", "NotoSans-Bold.woff2", "700"),
  ]);
  return { standing, crouching };
}
