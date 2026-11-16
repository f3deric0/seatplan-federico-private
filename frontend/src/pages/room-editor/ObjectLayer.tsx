import { useRef } from "react";
import type { PointerEvent } from "react";
import type { Point } from "./geometry";
import type { Room } from "./roomModel";
import { editFixture, editZone, FIXTURE_ICONS, FIXTURE_NAMES } from "./roomObjects";
import { snappedPoint } from "./shapeModel";

interface Props { room: Room; kind: "fixture" | "zone"; editing: boolean; selected: string | null; grid: boolean; zoom: number; toWorld: (event: { clientX: number; clientY: number }) => Point; onSelect: (key: string) => void; onChange: (room: Room, transient?: boolean) => void; onDragStart: () => void }
export function ObjectLayer({ room, kind, editing, selected, grid, zoom, toWorld, onSelect, onChange, onDragStart }: Props) {
  const drag = useRef<{ key: string; base: Room; start: Point; at: Point; last: Point; started: boolean } | null>(null);
  const items = kind === "fixture" ? room.fixtures : room.zones;
  const move = (event: PointerEvent<SVGGElement>) => {
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
  return <g className={`room-${kind}-layer`} style={{ pointerEvents: editing ? "auto" : "none" }} onPointerMove={move} onPointerUp={event => { if (editing) event.stopPropagation(); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onClick={event => { if (editing) event.stopPropagation(); }}>
    {items.map(item => {
      const rotation = "rotation" in item ? item.rotation : 0;
      const label = "label" in item ? [FIXTURE_ICONS[item.kind] === FIXTURE_NAMES[item.kind] ? "" : FIXTURE_ICONS[item.kind], item.label || FIXTURE_NAMES[item.kind]].filter(Boolean).join(" ") : item.name;
      return <g key={item.key} data-room-object={item.key} className={`room-${kind}${selected === item.key ? " selected" : ""}`} transform={`translate(${item.x + item.w / 2} ${item.y + item.h / 2}) rotate(${rotation})`} onPointerDown={event => {
        if (!editing) return;
        event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onSelect(item.key);
        drag.current = { key: item.key, base: room, start: toWorld(event), at: item, last: { x: item.x, y: item.y }, started: false };
      }}>
        {"shape" in item && item.shape === "circle" ? <circle r={item.w / 2} /> : <rect x={-item.w / 2} y={-item.h / 2} width={item.w} height={item.h} />}
        <text textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(13 / zoom, 15)}>{label}</text>
      </g>;
    })}
  </g>;
}
