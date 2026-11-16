import { bearing, outlineToPolygon, pointInPolygon, sideNormal } from "./geometry";
import type { Point } from "./geometry";
import type { Room, RoomZone } from "./roomModel";
import { addZone, editZone, removeZone } from "./roomObjects";
import { addOpening, updateOpening } from "./wallModel";

/*
 * What is outside a wall. It is kept as the view of a window on that wall (a view tag and a few words), which the diner's
 * plan already reads: the sea and a river are drawn as water along that edge, a park as green.
 */
export type SurroundingKind = "sea" | "river" | "park" | "street" | "city" | "hills";
export interface Surrounding { kind: SurroundingKind; label: string; tag: string; text: string; group: "water" | "green" | "other" }
export const SURROUNDINGS: readonly Surrounding[] = [
  { kind: "sea", label: "Sea", tag: "sea", text: "The sea", group: "water" },
  { kind: "river", label: "River", tag: "river", text: "The river", group: "water" },
  { kind: "park", label: "Park", tag: "garden", text: "A park", group: "green" },
  { kind: "street", label: "Street", tag: "street", text: "The street", group: "other" },
  { kind: "city", label: "City", tag: "city", text: "The city", group: "other" },
  { kind: "hills", label: "Hills", tag: "hills", text: "The hills", group: "other" },
];
const BY_TAG = new Map(SURROUNDINGS.map(s => [s.tag, s]));

/** What is outside this wall, if the owner said so. */
export function surroundingOf(room: Room, side: number): Surrounding | null {
  for (const opening of room.openings) {
    if (opening.side !== side || opening.kind !== "window") continue;
    const found = opening.view_tags.map(tag => BY_TAG.get(tag)).find(Boolean);
    if (found) return found;
  }
  return null;
}

/** Says what is outside a wall (or, with null, that nothing is). Adds a window to carry it when the wall has none. */
export function setSurrounding(room: Room, side: number, kind: SurroundingKind | null): Room {
  const windows = room.openings.filter(o => o.side === side && o.kind === "window");
  if (kind === null) {
    return { ...room, openings: room.openings.map(o => o.side === side && o.kind === "window" && o.view_tags.some(t => BY_TAG.has(t))
      ? { ...o, view_tags: o.view_tags.filter(t => !BY_TAG.has(t)), view_text: "" } : o) };
  }
  const wanted = SURROUNDINGS.find(s => s.kind === kind);
  if (!wanted) throw new Error("Choose what is outside the wall.");
  let next = room, target = windows.find(o => o.view_tags.some(t => BY_TAG.has(t))) ?? windows[0];
  if (!target) {
    try { next = addOpening(room, side, "window"); }
    catch { throw new Error("There is no room on this wall to say what is outside. Make space or choose another wall."); }
    target = next.openings.at(-1)!;
  }
  return updateOpening(next, target.key, { view_tags: [wanted.tag, ...target.view_tags.filter(t => !BY_TAG.has(t))].slice(0, 3), view_text: wanted.text });
}

const WORDS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
/** "south-east" for 135 degrees. */
export const directionWord = (degrees: number): string => WORDS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];

function outward(room: Room, side: number): { mid: Point; normal: Point } | null {
  const points = room.outline.points, n = points.length;
  if (n < 3 || side < 0 || side >= n) return null;
  const a = points[side], b = points[(side + 1) % n], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let normal = sideNormal(room.outline, side, 0.5);
  try { if (pointInPolygon({ x: mid.x + normal.x * 5, y: mid.y + normal.y * 5 }, outlineToPolygon(room.outline))) normal = { x: -normal.x, y: -normal.y }; } catch { /* keep it */ }
  return { mid, normal };
}

/** The way a wall faces, in degrees clockwise from north (the top of the plan). */
export function wallBearing(room: Room, side: number): number | null {
  const o = outward(room, side);
  return o ? bearing(o.normal.x, o.normal.y, room.north_deg ?? 0) : null;
}

/** The wall that faces nearest to this bearing, with how far off it is. */
export function wallFacing(room: Room, degrees: number): { side: number; off: number } | null {
  let best: { side: number; off: number } | null = null;
  room.outline.points.forEach((_, side) => {
    const facing = wallBearing(room, side);
    if (facing === null) return;
    const off = Math.abs(((facing - degrees + 540) % 360) - 180);
    if (!best || off < best.off) best = { side, off };
  });
  return best;
}

/** How deep a terrace is, in cm: room for a table, its chairs and a way past. */
export const TERRACE_DEPTH = 250;

/** The strip outside a wall, from `from` to `to` cm away from it. */
function strip(room: Room, side: number, from: number, to: number): Point[] | null {
  const o = outward(room, side), points = room.outline.points;
  if (!o) return null;
  const a = points[side], b = points[(side + 1) % points.length], at = (p: Point, d: number): Point => ({ x: p.x + o.normal.x * d, y: p.y + o.normal.y * d });
  return [at(a, from), at(b, from), at(b, to), at(a, to)];
}

/** The terrace outside a wall, if there is one: a terrace zone whose middle lies just outside it. */
export function terraceOn(room: Room, side: number): RoomZone | null {
  const area = strip(room, side, 0, TERRACE_DEPTH * 1.6);
  if (!area) return null;
  return room.zones.find(z => z.kind === "terrace" && pointInPolygon({ x: z.x + z.w / 2, y: z.y + z.h / 2 }, area)) ?? null;
}

/** Puts a terrace outside a wall (a terrace zone, so diners can look for one), or takes it away. */
export function setTerrace(room: Room, side: number, on: boolean): Room {
  const existing = terraceOn(room, side);
  if (!on) return existing ? removeZone(room, existing.key) : room;
  if (existing) return room;
  const quad = strip(room, side, 0, TERRACE_DEPTH);
  if (!quad) throw new Error("Choose a wall first.");
  const xs = quad.map(p => p.x), ys = quad.map(p => p.y), x = Math.round(Math.min(...xs)), y = Math.round(Math.min(...ys));
  const added = addZone(room, "terrace", { x, y });
  return editZone(added, added.zones.at(-1)!.key, { w: Math.max(100, Math.round(Math.max(...xs)) - x), h: Math.max(100, Math.round(Math.max(...ys)) - y) });
}

/** A table standing on a terrace belongs to it; one that leaves it does not. Returns the same room when nothing changes. */
export function assignTerraceTables(room: Room): Room {
  const terraces = room.zones.filter(z => z.kind === "terrace");
  if (!terraces.length && !room.tables.some(t => t.zone_key)) return room;
  let changed = false;
  const tables = room.tables.map(t => {
    const x = t.x + t.w / 2, y = t.y + t.h / 2, here = terraces.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    const current = room.zones.find(z => z.key === t.zone_key);
    let zone_key = t.zone_key;
    if (here) { if (!current || current.kind === "terrace") zone_key = here.key; }
    else if (current?.kind === "terrace") zone_key = null;
    if (zone_key === t.zone_key) return t;
    changed = true; return { ...t, zone_key };
  });
  return changed ? { ...room, tables } : room;
}

export interface Band { side: number; surrounding: Surrounding; quad: Point[]; label: Point }
/** The strips drawn outside the walls that have something outside them (beyond the terrace, when there is one). */
export function surroundingBands(room: Room, depth = 140): Band[] {
  const bands: Band[] = [];
  room.outline.points.forEach((_, side) => {
    const surrounding = surroundingOf(room, side), inset = terraceOn(room, side) ? TERRACE_DEPTH : 0, quad = strip(room, side, inset, inset + depth), o = outward(room, side);
    if (!surrounding || !quad || !o) return;
    bands.push({ side, surrounding, quad, label: { x: o.mid.x + o.normal.x * (inset + depth / 2), y: o.mid.y + o.normal.y * (inset + depth / 2) } });
  });
  return bands;
}
