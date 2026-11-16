import { expect, it } from "vitest";
import { createRoom } from "./roomModel";
import { directionWord, setSurrounding, surroundingBands, surroundingOf, wallBearing, wallFacing } from "./surroundings";
import { addOpening } from "./wallModel";

const room = () => createRoom("Room 1", 1000, 700); // walls: 0 top, 1 right, 2 bottom, 3 left

it("says what is outside a wall, adding a window to carry it", () => {
  const next = setSurrounding(room(), 2, "sea");
  expect(surroundingOf(next, 2)?.kind).toBe("sea");
  expect(surroundingOf(next, 0)).toBeNull();
  expect(next.openings).toHaveLength(1);
  expect(next.openings[0]).toMatchObject({ kind: "window", side: 2, view_tags: ["sea"], view_text: "The sea" });
});

it("changes and clears it, reusing the window, and keeps the owner's own words on other views", () => {
  let r = setSurrounding(room(), 1, "river");
  r = setSurrounding(r, 1, "park");
  expect(r.openings).toHaveLength(1);
  expect(surroundingOf(r, 1)?.kind).toBe("park");
  expect(r.openings[0].view_tags).toEqual(["garden"]);
  r = setSurrounding(r, 1, null);
  expect(surroundingOf(r, 1)).toBeNull();
  expect(r.openings).toHaveLength(1); // the window stays; only what it looks onto is cleared
  expect(r.openings[0]).toMatchObject({ view_tags: [], view_text: "" });
});

it("uses a window that is already on the wall", () => {
  const withWindow = addOpening(room(), 0, "window");
  const next = setSurrounding(withWindow, 0, "city");
  expect(next.openings).toHaveLength(1);
  expect(surroundingOf(next, 0)?.kind).toBe("city");
});

it("says so when the wall has no space for a window", () => {
  const door = addOpening(room(), 0, "door");
  const full = { ...door, openings: [{ ...door.openings[0], offset: 0, width: 1000 }] };
  expect(() => setSurrounding(full, 0, "sea")).toThrow("no room on this wall");
});

it("knows which way each wall faces and which wall faces a direction", () => {
  const r = room();
  expect([0, 1, 2, 3].map(s => wallBearing(r, s))).toEqual([0, 90, 180, 270]);
  expect(wallFacing(r, 170)).toEqual({ side: 2, off: 10 });
  expect(wallFacing(r, 350)?.side).toBe(0);
  expect(directionWord(135)).toBe("south-east");
});

it("draws a strip outside only the walls that have something outside them", () => {
  const r = setSurrounding(setSurrounding(room(), 2, "sea"), 1, "park");
  const bands = surroundingBands(r);
  expect(bands.map(b => [b.side, b.surrounding.kind])).toEqual([[1, "park"], [2, "sea"]]);
  const sea = bands.find(b => b.side === 2)!;
  expect(Math.max(...sea.quad.map(p => p.y))).toBeGreaterThan(700); // below the bottom wall, outside the room
  expect(sea.label.y).toBeGreaterThan(700);
});
