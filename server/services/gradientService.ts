import Vibrant from "node-vibrant";

const SWATCHES = ["Vibrant", "DarkVibrant", "LightVibrant", "Muted", "DarkMuted", "LightMuted"];
const cache = new Map<string, string[]>();

export async function getGradient(artworkUrl: string | null | undefined, max = 4): Promise<string[]> {
  if (!artworkUrl) return [];
  const cached = cache.get(artworkUrl);
  if (cached) return cached;

  try {
    const palette = await Vibrant.from(artworkUrl).getPalette();
    const swatches = palette as Record<string, { hex: string } | null>;
    const hexes: string[] = [];
    for (const name of SWATCHES) {
      const swatch = swatches[name];
      if (swatch && !hexes.includes(swatch.hex)) hexes.push(swatch.hex);
      if (hexes.length >= max) break;
    }
    cache.set(artworkUrl, hexes);
    return hexes;
  } catch (error) {
    console.warn(`gradient extraction failed for ${artworkUrl}: ${(error as Error).message}`);
    return [];
  }
}
