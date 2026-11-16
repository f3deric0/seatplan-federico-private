import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { normaliseNorth, northAt } from "./northModel";

/**
 * A small compass in the corner of the plan, like the one on a map: the needle shows where north is.
 * Drag it to turn north (previewed while dragging, committed on release), or use the keys:
 * arrows turn 1°, Shift+arrows or Page Up/Down turn 15°, Home points north up, Delete clears it.
 */
export function NorthCompass({ north, onChange }: { north: number | null; onChange: (north: number | null) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  const active = useRef(false);
  const shown = draft ?? north;
  const angle = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return northAt({ x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 });
  };
  const turn = (event: KeyboardEvent<HTMLDivElement>): number | null | undefined => {
    const step = event.shiftKey ? 15 : 1;
    switch (event.key) {
      case "ArrowRight": case "ArrowUp": return normaliseNorth((north ?? 0) + step);
      case "ArrowLeft": case "ArrowDown": return normaliseNorth((north ?? 0) - step);
      case "PageUp": return normaliseNorth((north ?? 0) + 15);
      case "PageDown": return normaliseNorth((north ?? 0) - 15);
      case "Home": return 0;
      case "Delete": case "Backspace": return null;
      default: return undefined;
    }
  };
  return <div
    className="room-compass" role="slider" tabIndex={0} aria-label="North direction" aria-valuemin={0} aria-valuemax={359}
    aria-valuenow={north ?? undefined} aria-valuetext={north === null ? "North is not set" : `North is at ${north}°`}
    title={north === null ? "North is not set. Drag to set it." : `North is at ${north}°. Drag to turn it.`}
    onKeyDown={event => { const next = turn(event); if (next === undefined) return; event.preventDefault(); event.stopPropagation(); onChange(next); }}
  >
    <svg
      viewBox="0 0 100 100" aria-hidden="true"
      onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); active.current = true; setDraft(angle(event)); }}
      onPointerMove={event => { if (active.current) { event.stopPropagation(); setDraft(angle(event)); } }}
      onPointerUp={event => { if (!active.current) return; event.stopPropagation(); active.current = false; const next = angle(event); setDraft(null); onChange(next); }}
      onPointerCancel={() => { active.current = false; setDraft(null); }}
    >
      <circle cx="50" cy="50" r="46" />
      <g className={shown === null ? "is-unset" : undefined} transform={`rotate(${shown ?? 0} 50 50)`}>
        <path className="room-compass-north" d="M 50 27 L 60 52 L 50 47 L 40 52 Z" />
        <path className="room-compass-south" d="M 50 77 L 60 52 L 50 47 L 40 52 Z" />
        <text x="50" y="17" textAnchor="middle" dominantBaseline="central">N</text>
      </g>
      <circle className="room-compass-hub" cx="50" cy="50" r="3" />
    </svg>
  </div>;
}
