// Pure geometry for the diner's floor plan (FloorPlan.tsx): how big the picture is, where the
// view outside a glass wall is drawn, and how a wide plan turns a quarter to fill a phone.
// No React here, so every rule is tested on its own (floorPlanScene.test.ts).
import type { MapRoom, MapSeat, MapTable, MapZone } from "../../api/types";
import { contentBounds } from "../../seatmap/geometry";
import type { Bounds } from "../../seatmap/geometry";
import { mergeBounds, roomsBounds } from "../../seatmap/roomScene";
import { sideNormal } from "../room-editor/geometry";

export type Side = "up" | "down" | "left" | "right";

/** The view through a glass wall or window, drawn as a band along that edge of the plan. */
export interface ViewBand {
  side: Side;
  kind: "water" | "green";
  text: string;
  /** The band itself, in venue units. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How thick a view band is, in venue units, and how far it sits from the rooms. */
export const BAND = 34;
const GAP = 10;

const WATER = ["water", "river", "sea", "ocean", "lake", "harbour", "harbor", "beach"];
const GREEN = ["garden", "park", "trees", "greenery", "patio", "courtyard"];

function viewKind(tags: string[], text: string): ViewBand["kind"] | null {
  const words = [...tags, ...text.toLowerCase().split(/\W+/)].map((word) => word.toLowerCase());
  if (words.some((word) => WATER.includes(word))) return "water";
  if (words.some((word) => GREEN.includes(word))) return "green";
  return null;
}

function sideOf(out: { x: number; y: number }): Side {
  if (Math.abs(out.x) > Math.abs(out.y)) return out.x > 0 ? "right" : "left";
  return out.y > 0 ? "down" : "up";
}

/** One view per edge of the plan, water first: the river or the garden the windows look onto. */
export function viewSides(rooms: readonly MapRoom[]): { side: Side; kind: ViewBand["kind"]; text: string }[] {
  const found = new Map<Side, { side: Side; kind: ViewBand["kind"]; text: string }>();
  for (const room of rooms) {
    for (const opening of room.openings) {
      if (opening.kind === "door") continue;
      const text = (room.night && opening.night_view_text.trim()) || opening.view_text.trim();
      const kind = viewKind(opening.view_tags, opening.view_text);
      if (!kind || !text) continue;
      const side = sideOf(sideNormal(room.outline, opening.side, 0.5));
      const before = found.get(side);
      if (!before || (before.kind !== "water" && kind === "water")) found.set(side, { side, kind, text });
    }
  }
  return [...found.values()];
}

/** The box around rooms, tables, chairs and zones, with room for the view bands. */
export function planLayout(tables: MapTable[], seats: MapSeat[], zones: MapZone[], rooms: readonly MapRoom[]): { bounds: Bounds; bands: ViewBand[] } {
  const inner = mergeBounds(contentBounds(tables, seats, 40, zones), roomsBounds(rooms));
  const bounds = { ...inner };
  const bands: ViewBand[] = [];
  for (const view of viewSides(rooms)) {
    const across = view.side === "up" || view.side === "down";
    const w = across ? inner.maxX - inner.minX : BAND;
    const h = across ? BAND : inner.maxY - inner.minY;
    const x = view.side === "left" ? inner.minX - BAND + GAP : view.side === "right" ? inner.maxX - GAP : inner.minX;
    const y = view.side === "up" ? inner.minY - BAND + GAP : view.side === "down" ? inner.maxY - GAP : inner.minY;
    bands.push({ ...view, x, y, w, h });
    if (view.side === "up") bounds.minY = Math.min(bounds.minY, y - GAP / 2);
    if (view.side === "down") bounds.maxY = Math.max(bounds.maxY, y + h + GAP / 2);
    if (view.side === "left") bounds.minX = Math.min(bounds.minX, x - GAP / 2);
    if (view.side === "right") bounds.maxX = Math.max(bounds.maxX, x + w + GAP / 2);
  }
  return { bounds, bands };
}

/** A wide plan turns a quarter on a narrow screen, so its long side runs down the page. */
export function shouldTurn(bounds: Bounds, narrow: boolean): boolean {
  return narrow && bounds.maxX - bounds.minX > (bounds.maxY - bounds.minY) * 1.15;
}

/** Where a venue point lands on screen. Turned, it is SVG's rotate(90): (x, y) becomes (-y, x). */
export function project(point: { x: number; y: number }, turned: boolean): { x: number; y: number } {
  return turned ? { x: -point.y, y: point.x } : { x: point.x, y: point.y };
}

/** The SVG viewBox for the plan, turned or not. */
export function viewBox(bounds: Bounds, turned: boolean): { x: number; y: number; w: number; h: number } {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  return turned ? { x: -bounds.maxY, y: bounds.minX, w: h, h: w } : { x: bounds.minX, y: bounds.minY, w, h };
}
