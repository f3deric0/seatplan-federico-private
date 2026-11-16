import { GridLayer, type Coords, type DoneCallback } from "leaflet";
import { readMapLayers, traceGeometry } from "./vectorTile";

const TILE_URL = "https://tiles.openfreemap.org/planet/latest";
const LAND = "#dfedf2";
const WATER = "#b8eaf4";
const PARK = "#c5ece1";
const BUILDING = "#edf6f8";
const STREET = "#fbfeff";

const visibleLayers = new Set(["landuse", "landcover", "park", "water", "waterway", "building", "transportation"]);
const greenAreas = new Set(["grass", "wood", "forest", "park", "garden", "recreation_ground", "cemetery", "golf_course", "pitch"]);
const urbanAreas = new Set(["residential", "commercial", "industrial", "retail"]);
const roadWidths: Readonly<Record<string, number>> = {
  motorway: 5.4, trunk: 4.5, primary: 3.5, secondary: 2.6, tertiary: 1.9,
  minor: 1.15, service: 0.8, path: 0.55,
};

function drawMapTile(ctx: CanvasRenderingContext2D, bytes: Uint8Array, size: number, zoom: number) {
  const layers = readMapLayers(bytes, visibleLayers);
  ctx.fillStyle = LAND;
  ctx.fillRect(0, 0, size, size);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const draw = (name: string, kind: number, paint: (category: string) => boolean) => {
    const layer = layers.get(name);
    if (!layer) return;
    for (const feature of layer.features) {
      if (feature.kind !== kind || !paint(feature.category ?? "")) continue;
      ctx.beginPath();
      traceGeometry(ctx, feature.geometry, size / layer.extent);
      if (kind === 3) ctx.fill("evenodd");
      else ctx.stroke();
    }
  };
  const fill = (color: string) => { ctx.fillStyle = color; return true; };

  draw("landuse", 3, category => {
    if (greenAreas.has(category)) return fill(PARK);
    return urbanAreas.has(category) && fill("#d8e9ef");
  });
  draw("landcover", 3, category => greenAreas.has(category) && fill(PARK));
  draw("park", 3, () => fill(PARK));
  ctx.strokeStyle = WATER;
  ctx.lineWidth = zoom >= 13 ? 1.5 : 0.8;
  draw("waterway", 2, () => true);
  draw("water", 3, () => fill(WATER));
  if (zoom >= 13) draw("building", 3, () => fill(BUILDING));

  ctx.strokeStyle = STREET;
  const detail = zoom < 11 ? 0.55 : zoom < 13 ? 0.78 : 1;
  draw("transportation", 2, category => {
    const width = Object.hasOwn(roadWidths, category) ? roadWidths[category] : 0;
    if (width === 0 || (category === "path" && zoom < 14)) return false;
    ctx.lineWidth = width * detail;
    return true;
  });
}

export class DiscoveryBasemap extends GridLayer {
  private readonly requests = new WeakMap<HTMLElement, AbortController>();

  constructor() {
    super({ maxNativeZoom: 14, maxZoom: 19 });
    this.on("tileunload", ({ tile }) => this.requests.get(tile)?.abort());
  }

  override createTile({ x, y, z }: Coords, done: DoneCallback): HTMLElement {
    const tile = document.createElement("canvas");
    const size = this.getTileSize().x;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    tile.width = tile.height = size * density;
    tile.setAttribute("aria-hidden", "true");
    const request = new AbortController();
    this.requests.set(tile, request);

    void fetch(`${TILE_URL}/${z}/${x}/${y}.pbf`, {
      signal: request.signal,
      credentials: "omit",
    }).then(async response => {
      if (!response.ok) throw new Error(`Map tile returned ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (request.signal.aborted) return;
      const context = tile.getContext("2d");
      if (!context) throw new Error("Map canvas unavailable");
      context.scale(density, density);
      drawMapTile(context, bytes, size, z);
      done(undefined, tile);
    }).catch((error: unknown) => {
      if (!request.signal.aborted) done(error instanceof Error ? error : new Error("Map tile failed"), tile);
    });
    return tile;
  }
}
