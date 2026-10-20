/**
 * Dynamic color extraction utility for Sonara
 * Samples album artwork via offscreen canvas to compute dominant vibrant accent color
 */

export interface ExtractedColors {
  primary: string;
  glow: string;
  secondary: string;
}

const DEFAULT_COLORS: ExtractedColors = {
  primary: "#8b5cf6", // Sonara Violet
  glow: "rgba(139, 92, 246, 0.4)",
  secondary: "#06b6d4", // Sonara Cyan
};

const colorCache = new Map<string, ExtractedColors>();

export async function extractDominantColor(imageUrl?: string): Promise<ExtractedColors> {
  if (!imageUrl) return DEFAULT_COLORS;
  if (colorCache.has(imageUrl)) return colorCache.get(imageUrl)!;

  return new Promise((resolve) => {
    // If running server-side, return default immediately
    if (typeof window === "undefined") {
      return resolve(DEFAULT_COLORS);
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;

    const timeout = setTimeout(() => {
      resolve(DEFAULT_COLORS);
    }, 1500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(DEFAULT_COLORS);

        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const imgData = ctx.getImageData(0, 0, 40, 40).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const red = imgData[i];
          const green = imgData[i + 1];
          const blue = imgData[i + 2];
          // Exclude extremely dark or blown out white pixels
          const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
          if (brightness > 35 && brightness < 220) {
            r += red;
            g += green;
            b += blue;
            count++;
          }
        }

        if (count === 0) return resolve(DEFAULT_COLORS);

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Boost saturation slightly for vibrant feel
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let [h, s, l] = rgbToHsl(r, g, b);
        s = Math.min(1, s * 1.35); // Boost saturation
        l = Math.max(0.4, Math.min(0.65, l)); // Ensure good contrast
        const [nr, ng, nb] = hslToRgb(h, s, l);

        const primaryHex = rgbToHex(nr, ng, nb);
        const result: ExtractedColors = {
          primary: primaryHex,
          glow: `rgba(${nr}, ${ng}, ${nb}, 0.45)`,
          secondary: `rgba(${nr}, ${ng}, ${nb}, 0.15)`,
        };

        colorCache.set(imageUrl, result);
        resolve(result);
      } catch {
        resolve(DEFAULT_COLORS);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(DEFAULT_COLORS);
    };
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
