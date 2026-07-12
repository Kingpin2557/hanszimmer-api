import Vibrant from "node-vibrant";

// A node-vibrant swatch: we only need its hex + how many pixels it covers.
type Swatch = { hex: string; getPopulation: () => number };

const cache = new Map<string, string[]>();

/**
 * Extract the most VISIBLE colors from an artwork, ordered by how much of the
 * poster they actually cover (population), not by node-vibrant's semantic
 * priority. This stops a small but saturated accent (e.g. a red title on a
 * mostly-blue poster) from dominating the gradient. Returns up to `max` colors.
 */
export async function getGradient(
  artworkUrl: string | null | undefined,
  max = 5,
): Promise<string[]> {
  if (!artworkUrl) return [];
  const cached = cache.get(artworkUrl);
  if (cached) return cached;

  try {
    // quality(1) samples every pixel -> more accurate dominant colors.
    const palette = await Vibrant.from(artworkUrl).quality(1).getPalette();

    const swatches = Object.values(palette as Record<string, Swatch | null>)
      .filter((s): s is Swatch => !!s)
      // Most-covered color first = "what the poster mostly looks like".
      .sort((a, b) => b.getPopulation() - a.getPopulation());

    const hexes: string[] = [];
    for (const swatch of swatches) {
      if (!hexes.includes(swatch.hex)) hexes.push(swatch.hex);
      if (hexes.length >= max) break;
    }

    cache.set(artworkUrl, hexes);
    return hexes;
  } catch (error) {
    console.warn(`gradient extraction failed for ${artworkUrl}: ${(error as Error).message}`);
    return [];
  }
}
