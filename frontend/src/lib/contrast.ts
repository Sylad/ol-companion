/** Contraste WCAG 2.x entre deux couleurs RGB (composantes 0–1). */
export type Rgb = [number, number, number];

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** Jeton CSS sans fonction : `228 21% 8%`. */
export function hslTokenToRgb(token: string): Rgb {
  const [h, s, l] = token.split(/\s+/).map((p) => parseFloat(p));
  return hslToRgb(h, s, l);
}

/** Couleur `hsl(224, 64%, 33%)`. */
export function parseHsl(color: string): Rgb {
  const [h, s, l] = (color.match(/[\d.]+/g) ?? []).map(Number);
  return hslToRgb(h, s, l);
}

function luminance([r, g, b]: Rgb): number {
  const [R, G, B] = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
