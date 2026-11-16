import { useRef } from "react";
import type { PointerEvent } from "react";
import type { Point } from "./geometry";
import type { Room, RoomFixture } from "./roomModel";
import { FixtureIcon } from "./FixtureIcon";
import { editFixture, editZone, FIXTURE_NAMES } from "./roomObjects";
import { snappedPoint } from "./shapeModel";

interface Props { room: Room; kind: "fixture" | "zone"; editing: boolean; selected: string | null; grid: boolean; zoom: number; toWorld: (event: { clientX: number; clientY: number }) => Point; onSelect: (key: string) => void; onChange: (room: Room, transient?: boolean) => void; onDragStart: () => void }
interface Resize { key: string; base: Room; item: RoomFixture; sx: number; sy: number; started: boolean }
const MIN_SIZE = 20;
// The eight grips of a selected element: the corners and the middle of each side.
const GRIPS: [number, number, string][] = [[-1, -1, "nwse-resize"], [0, -1, "ns-resize"], [1, -1, "nesw-resize"], [1, 0, "ew-resize"], [1, 1, "nwse-resize"], [0, 1, "ns-resize"], [-1, 1, "nesw-resize"], [-1, 0, "ew-resize"]];
const turn = (p: Point, degrees: number): Point => { const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };

export function ObjectLayer({ room, kind, editing, selected, grid, zoom, toWorld, onSelect, onChange, onDragStart }: Props) {
  const drag = useRef<{ key: string; base: Room; start: Point; at: Point; last: Point; started: boolean } | null>(null);
  const resize = useRef<Resize | null>(null);
  const items = kind === "fixture" ? room.fixtures : room.zones;
  // Pulling a grip: the opposite side or corner stays put, and the element never leaves the room.
  const stretch = (event: PointerEvent<SVGGElement>) => {
    const r = resize.current!, f = r.item;
    event.stopPropagation();
    if (!r.started) { onDragStart(); r.started = true; }
    const centre = { x: f.x + f.w / 2, y: f.y + f.h / 2 }, world = toWorld(event);
    const local = turn({ x: world.x - centre.x, y: world.y - centre.y }, -f.rotation);
    const size = (value: number) => Math.max(MIN_SIZE, grid ? Math.round(value / 10) * 10 : Math.round(value));
    let w = f.w, h = f.h;
    if (r.sx) w = size(r.sx > 0 ? local.x + f.w / 2 : f.w / 2 - local.x);
    if (r.sy) h = size(r.sy > 0 ? local.y + f.h / 2 : f.h / 2 - local.y);
    if (f.shape === "circle") { const side = r.sx && r.sy ? Math.max(w, h) : r.sx ? w : h; w = side; h = side; }
    const shift = turn({ x: r.sx * (w - f.w) / 2, y: r.sy * (h - f.h) / 2 }, f.rotation);
    try { onChange(editFixture(r.base, r.key, { x: Math.round(centre.x + shift.x - w / 2), y: Math.round(centre.y + shift.y - h / 2), w, h }), true); } catch { /* it would leave the room: keep the last size */ }
  };
  const move = (event: PointerEvent<SVGGElement>) => {
    if (resize.current) { stretch(event); return; }
    const d = drag.current; if (!d) return;
    event.stopPropagation();
    const point = toWorld(event), dx = point.x - d.start.x, dy = point.y - d.start.y;
    if (!d.started && Math.hypot(dx, dy) * zoom < 5) return;
    if (!d.started) { onDragStart(); d.started = true; }
    const next = snappedPoint({ x: d.at.x + dx, y: d.at.y + dy }, null, grid, false);
    if (kind === "zone") { onChange(editZone(d.base, d.key, next), true); return; }
    // A fixed element stays inside the room: it stops at a wall and slides along it instead of leaving.
    for (const spot of [next, { x: next.x, y: d.last.y }, { x: d.last.x, y: next.y }]) {
      try { onChange(editFixture(d.base, d.key, spot), true); d.last = spot; return; } catch { /* outside the room: try the next spot */ }
    }
  };
  return <g className={`room-${kind}-layer`} style={{ pointerEvents: editing ? "auto" : "none" }} onPointerMove={move} onPointerUp={event => { if (editing) event.stopPropagation(); drag.current = null; resize.current = null; }} onPointerCancel={() => { drag.current = null; resize.current = null; }} onClick={event => { if (editing) event.stopPropagation(); }}>
    {items.map(item => {
      const rotation = "rotation" in item ? item.rotation : 0;
      const label = "label" in item ? item.label || FIXTURE_NAMES[item.kind] : item.name;
      const font = Math.max(13 / zoom, 15), small = Math.min(item.w, item.h), fixture = "label" in item ? item : null, icon = fixture && small >= font * 2.6 ? Math.min(32, small * 0.45) : 0;
      return <g key={item.key} data-room-object={item.key} className={`room-${kind}${selected === item.key ? " selected" : ""}`} transform={`translate(${item.x + item.w / 2} ${item.y + item.h / 2}) rotate(${rotation})`} onPointerDown={event => {
        if (!editing) return;
        event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onSelect(item.key);
        drag.current = { key: item.key, base: room, start: toWorld(event), at: item, last: { x: item.x, y: item.y }, started: false };
      }}>
        {"shape" in item && item.shape === "circle" ? <circle r={item.w / 2} /> : <rect x={-item.w / 2} y={-item.h / 2} width={item.w} height={item.h} />}
        {icon > 0 && fixture && <g transform={`translate(0 ${-font * 0.7})`}><FixtureIcon kind={fixture.kind} size={icon} /></g>}
        <text textAnchor="middle" dominantBaseline="middle" y={icon > 0 ? font * 0.8 : 0} fontSize={font}>{label}</text>
        {kind === "fixture" && editing && selected === item.key && "shape" in item && GRIPS.map(([sx, sy, cursor]) => <g key={`${sx}${sy}`} data-fixture-grip={`${sx},${sy}`} transform={`translate(${sx * item.w / 2} ${sy * item.h / 2})`} style={{ cursor }}
          onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onSelect(item.key); resize.current = { key: item.key, base: room, item, sx, sy, started: false }; }}>
          <circle r={22 / zoom} className="room-handle-hit" /><rect x={-6 / zoom} y={-6 / zoom} width={12 / zoom} height={12 / zoom} className="room-handle" />
        </g>)}
      </g>;
    })}
  </g>;
}
