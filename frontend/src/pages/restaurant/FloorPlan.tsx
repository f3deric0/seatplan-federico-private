// FloorPlan: the diner's picture of the restaurant. Every room at once, as it really is (wooden
// floor inside, stone outside, glass walls, the river or garden beyond them), the sun on the floor
// by day and a candle on every free table after dark. Three looks for a table and no more:
// free (white, green edge), yours (green, gold ring) and not for you (hatched, dashed).
//
// Restaurant screens only: events keep the shared SeatMap. Like SeatMap it is one listbox with a
// table per option, the arrow keys move between tables and Enter or Space chooses one, so screen
// readers and tests read it the same way. It has no zoom: the whole room fits the width, and on a
// phone a wide room turns a quarter so it fills the screen.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import type { MapRoom, MapSeat, MapTable, MapZone } from "../../api/types";
import { describeItem } from "../../seatmap/describe";
import type { DescribeItem } from "../../seatmap/describe";
import { tableCentre } from "../../seatmap/geometry";
import { handleMapKey } from "../../seatmap/mapKeyboard";
import { fixtureName, openingPath, outlinePath, polygonPath } from "../../seatmap/roomScene";
import { planLayout, project, shouldTurn, viewBox } from "./floorPlanScene";
import "./floor-plan.css";

export interface FloorPlanProps {
  /** Accessible name of the plan, e.g. "Floor plan for 20:00". */
  label: string;
  /** Every table, with the state to draw already set (tablesForMap). */
  tables: MapTable[];
  seats: MapSeat[];
  rooms: MapRoom[];
  zones?: MapZone[];
  /** The room being chosen in: its tables are the options; the other rooms are drawn around it. Undefined: every room. */
  activeRoomId?: number | null;
  selectable: (id: number) => boolean;
  selectedId: number | null;
  /** Our suggestion: an "Our pick" label above it. */
  highlight: ReadonlySet<number>;
  describe?: DescribeItem;
  /** A tap on a table, Enter or Space. A table of another room is passed too: the page moves to that room. */
  onSelect?: (id: number) => void;
  /** The table under the pointer or the keyboard cursor, or null. */
  onActiveChange?: (id: number | null) => void;
  /** True on a phone-width screen: a wide plan turns a quarter. */
  narrow?: boolean;
  /** False draws the plan only, without choosing (the "Your table" card). */
  interactive?: boolean;
}

const NONE: ReadonlySet<number> = new Set();

function roomOf(table: MapTable): number | null {
  return table.room_id ?? null;
}

/** CSS pixels to plan units, from the drawn width, so text keeps the same size on any screen. */
function useUnitsPerPixel(ref: RefObject<SVGSVGElement>, boxWidth: number): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const read = (): void => setWidth(svg.getBoundingClientRect().width);
    read();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(read);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [ref]);
  return width > 0 ? boxWidth / width : Math.max(1, boxWidth / 760);
}

function Body({ table, grow = 0, className }: { table: MapTable; grow?: number; className: string }) {
  const { x, y } = tableCentre(table);
  if (table.shape === "round") return <ellipse className={className} cx={x} cy={y} rx={table.w / 2 + grow} ry={table.h / 2 + grow} />;
  return <rect className={className} x={table.x - grow} y={table.y - grow} width={table.w + grow * 2} height={table.h + grow * 2} rx={8 + grow} />;
}

export function FloorPlan(props: FloorPlanProps) {
  const { label, tables, seats, rooms, zones = [], activeRoomId, selectable, selectedId, highlight = NONE, describe, onSelect, onActiveChange, narrow = false, interactive = true } = props;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { bounds, bands } = useMemo(() => planLayout(tables, seats, zones, rooms), [tables, seats, zones, rooms]);
  const turned = shouldTurn(bounds, narrow);
  const fitted = viewBox(bounds, turned);
  const u = useUnitsPerPixel(svgRef, fitted.w);
  const px = (size: number): number => size * u;
  // A turned plan writes the room names under the rooms (above them, they would meet "Our pick"): keep room for them.
  const namesBelow = turned && rooms.length > 1;
  const box = namesBelow ? { ...fitted, h: fitted.h + px(26) } : fitted;
  const at = (x: number, y: number) => project({ x, y }, turned);

  const seatsOf = useMemo(() => {
    const byTable = new Map<number, MapSeat[]>();
    for (const seat of seats) byTable.set(seat.table_id, [...(byTable.get(seat.table_id) ?? []), seat]);
    return byTable;
  }, [seats]);
  const inPlay = (table: MapTable): boolean => activeRoomId === undefined || roomOf(table) === activeRoomId;
  const options = tables.filter(inPlay);
  const nightRooms = rooms.filter((room) => room.night);
  const nightIds = new Set(nightRooms.map((room) => room.id));

  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const shownId = hoverId ?? activeId;
  useEffect(() => {
    onActiveChange?.(shownId);
    // Only a change of table is news; a new callback each render is not.
  }, [shownId]);

  const choose = (tableId: number): void => {
    if (!interactive || !selectable(tableId)) return;
    onSelect?.(tableId);
  };
  // Arrow keys follow the screen, so on a turned plan "down" still means down the screen.
  const points = options.map((table) => ({ id: table.id, ...at(tableCentre(table).x, tableCentre(table).y) }));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const handled = handleMapKey(event, {
      points,
      activeId,
      moveTo: setActiveId,
      pick: choose,
      zoomBy: () => undefined,
      fit: () => undefined,
      leave: () => viewportRef.current?.blur(),
    });
    if (handled) event.preventDefault();
  };
  const pointer = useRef(false);
  const onFocus = (): void => {
    if (pointer.current || (activeId !== null && options.some((t) => t.id === activeId))) return;
    const start = options.find((t) => t.id === selectedId) ?? options.find((t) => highlight.has(t.id)) ?? options.find((t) => selectable(t.id)) ?? options[0];
    if (start) setActiveId(start.id);
  };

  const domId = (tableId: number): string => `${id}-t${tableId}`;
  const look = (table: MapTable): string => {
    if (table.id === selectedId) return "fp-table is-selected";
    if (!selectable(table.id)) return "fp-table is-off";
    return "fp-table is-free";
  };

  const drawing = (
    <>
      {bands.map((band) => (
        <g key={band.side} className={`fp-band fp-band-${band.kind}`}>
          <rect x={band.x} y={band.y} width={band.w} height={band.h} rx={14} />
          {Array.from({ length: Math.max(2, Math.round((band.w + band.h) / 220)) }, (_, i) => {
            const along = band.w > band.h;
            const step = (along ? band.w : band.h) / (Math.round((band.w + band.h) / 220) + 1);
            const cx = along ? band.x + step * (i + 0.6) : band.x + band.w / 2 + (i % 2 ? 12 : -12);
            const cy = along ? band.y + band.h / 2 + (i % 2 ? 12 : -12) : band.y + step * (i + 0.6);
            const middle = along ? Math.abs(cx - (band.x + band.w / 2)) : Math.abs(cy - (band.y + band.h / 2));
            if (middle < 150) return null;
            return along ? <line key={i} x1={cx - 22} y1={cy} x2={cx + 22} y2={cy} /> : <line key={i} x1={cx} y1={cy - 22} x2={cx} y2={cy + 22} />;
          })}
        </g>
      ))}
      {rooms.map((room) => (
        <g key={room.id ?? "room"} data-room={room.id ?? "implicit"} className={`fp-room ${room.is_outdoor ? "is-outdoor" : "is-indoor"}${room.night ? " is-night" : ""}`}>
          <clipPath id={`${id}-clip-${room.id ?? "x"}`}>
            <path d={outlinePath(room.outline)} />
          </clipPath>
          <path className="fp-floor" d={outlinePath(room.outline)} fill={`url(#${id}-${room.is_outdoor ? "stone" : "oak"}${room.night ? "-night" : ""})`} />
          {!room.night &&
            room.sun_patches.map((patch, i) => (
              <path key={i} className="room-sun fp-sun" d={polygonPath(patch)} clipPath={`url(#${id}-clip-${room.id ?? "x"})`} />
            ))}
          <path className="fp-wall" d={outlinePath(room.outline)} />
          {room.openings.map((opening) => (
            <path key={opening.id} className={opening.kind === "door" ? "fp-door" : "fp-glass"} d={openingPath(room.outline, opening)} />
          ))}
          {room.fixtures.map((fixture) =>
            fixture.shape === "circle" ? (
              <ellipse key={fixture.id} className="fp-fixture" cx={fixture.x + fixture.w / 2} cy={fixture.y + fixture.h / 2} rx={fixture.w / 2} ry={fixture.h / 2} />
            ) : (
              <rect key={fixture.id} className="fp-fixture" x={fixture.x} y={fixture.y} width={fixture.w} height={fixture.h} rx={6} transform={fixture.rotation ? `rotate(${fixture.rotation} ${fixture.x + fixture.w / 2} ${fixture.y + fixture.h / 2})` : undefined} />
            ),
          )}
        </g>
      ))}
      {nightRooms.length > 0 && (
        <g className="room-night fp-night">
          {nightRooms.map((room) => (
            <path key={room.id ?? "room"} d={outlinePath(room.outline)} />
          ))}
        </g>
      )}
    </>
  );

  const tableShapes = tables.map((table) => {
    const c = tableCentre(table);
    const playable = inPlay(table);
    const free = selectable(table.id);
    const candle = free && nightIds.has(roomOf(table));
    const hit = Math.max(table.w, table.h) / 2 + Math.max(18, px(10));
    const name = describeItem({ kind: "table", table, seats: seatsOf.get(table.id) ?? [] }, { recommended: highlight.has(table.id), selected: table.id === selectedId }, describe);
    const shape = (
      <g transform={table.rotation ? `rotate(${table.rotation} ${c.x} ${c.y})` : undefined}>
        {candle && <circle className="fp-glow" cx={c.x} cy={c.y} r={Math.max(table.w, table.h) * 0.95} fill={`url(#${id}-glow)`} />}
        <circle className="fp-hit" cx={c.x} cy={c.y} r={hit} />
        {(seatsOf.get(table.id) ?? []).map((seat) => (
          <rect key={seat.id} className="fp-chair" x={seat.x - 9} y={seat.y - 9} width={18} height={18} rx={6} />
        ))}
        {table.id === selectedId && <Body table={table} grow={7} className="fp-ring" />}
        {table.id === activeId && <Body table={table} grow={12} className="fp-cursor" />}
        <Body table={table} className="fp-top" />
        {table.id === selectedId && (
          // A tick as well as the colour, so "yours" never rests on colour alone. Upright on a turned plan.
          <g className="selected-tick fp-tick" transform={`${turned ? `rotate(-90 ${c.x + table.w / 2} ${c.y - table.h / 2}) ` : ""}translate(${c.x + table.w / 2} ${c.y - table.h / 2})`}>
            <circle r={11} />
            <path d="M-5 0l3.5 3.5L5.5-4" />
          </g>
        )}
      </g>
    );
    const common = {
      className: `${look(table)} state-${table.state ?? "free"}${playable ? "" : " is-elsewhere"}${free && interactive ? " is-pickable" : ""}`,
      onClick: () => (playable ? choose(table.id) : free && interactive && onSelect?.(table.id)),
      onPointerEnter: () => interactive && playable && setHoverId(table.id),
      onPointerLeave: () => setHoverId((current) => (current === table.id ? null : current)),
    };
    if (!interactive || !playable) {
      return (
        <g key={table.id} {...common} aria-hidden="true">
          {shape}
        </g>
      );
    }
    return (
      <g key={table.id} {...common} id={domId(table.id)} role="option" aria-label={name} aria-selected={table.id === selectedId} aria-disabled={!free}>
        {shape}
      </g>
    );
  });

  // Words stay upright and readable on a turned plan, so they are drawn after the turn.
  const words = (
    <g className="fp-words" aria-hidden="true">
      {bands.map((band) => {
        const middle = at(band.x + band.w / 2, band.y + band.h / 2);
        const vertical = turned ? band.w > band.h : band.h > band.w;
        return (
          <text key={band.side} className="fp-band-text" x={middle.x} y={middle.y} fontSize={px(15)} transform={vertical ? `rotate(-90 ${middle.x} ${middle.y})` : undefined}>
            {band.text}
          </text>
        );
      })}
      {rooms.length > 1 &&
        rooms.map((room) => {
          const xs = room.outline.points.map((p) => p.x);
          const ys = room.outline.points.map((p) => p.y);
          const corners = [at(Math.min(...xs), Math.min(...ys)), at(Math.max(...xs), Math.max(...ys))];
          const left = Math.min(corners[0].x, corners[1].x);
          const top = Math.min(corners[0].y, corners[1].y);
          const bottom = Math.max(corners[0].y, corners[1].y);
          const across = Math.abs(corners[0].x - corners[1].x);
          const size = Math.min(px(15), (across / Math.max(6, room.name.length)) * 1.7);
          return (
            <text key={room.id ?? "room"} className={`fp-room-name${room.night ? " is-night" : ""}`} x={left + px(2)} y={namesBelow ? bottom + px(18) : top - px(7)} fontSize={size}>
              {room.name}
            </text>
          );
        })}
      {rooms.flatMap((room) =>
        room.fixtures.map((fixture) => {
          const p = at(fixture.x + fixture.w / 2, fixture.y + fixture.h / 2);
          return (
            <text key={`f${fixture.id}`} className={`fp-fixture-text${room.night ? " is-night" : ""}`} x={p.x} y={p.y} fontSize={Math.min(px(11), Math.max(fixture.w, fixture.h) / 3.2)}>
              {fixtureName(fixture)}
            </text>
          );
        }),
      )}
      {tables.map((table) => {
        const c = tableCentre(table);
        const p = at(c.x, c.y);
        return (
          <text key={`t${table.id}`} className={`fp-code${table.id === selectedId ? " is-selected" : selectable(table.id) ? "" : " is-off"}`} x={p.x} y={p.y} fontSize={Math.min(px(12), Math.min(table.w, table.h) * 0.5)}>
            {table.label}
          </text>
        );
      })}
      {tables
        .filter((table) => highlight.has(table.id) && selectable(table.id))
        .slice(0, 1)
        .map((table) => {
          const c = tableCentre(table);
          const p = at(c.x, c.y);
          const half = (turned ? table.w : table.h) / 2 + 18;
          const w = px(64);
          const h = px(20);
          const top = p.y - half - h - px(4);
          return (
            <g key="pick" className="fp-pick">
              <rect x={p.x - w / 2} y={top} width={w} height={h} rx={h / 2} />
              <text x={p.x} y={top + h / 2} fontSize={px(11.5)}>
                Our pick
              </text>
            </g>
          );
        })}
    </g>
  );

  const svg = (
    <svg ref={svgRef} className="fp-svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} aria-hidden={interactive ? undefined : "true"}>
      <defs>
        <pattern id={`${id}-oak`} width="44" height="16" patternUnits="userSpaceOnUse">
          <rect className="fp-oak" width="44" height="16" />
          <path className="fp-oak-line" d="M0 15.5h44M24 0v16" />
        </pattern>
        <pattern id={`${id}-oak-night`} width="44" height="16" patternUnits="userSpaceOnUse">
          <rect className="fp-oak-night" width="44" height="16" />
          <path className="fp-oak-night-line" d="M0 15.5h44M24 0v16" />
        </pattern>
        <pattern id={`${id}-stone`} width="38" height="38" patternUnits="userSpaceOnUse">
          <rect className="fp-stone" width="38" height="38" />
          <path className="fp-stone-line" d="M0 37.5h38M37.5 0v38" />
        </pattern>
        <pattern id={`${id}-stone-night`} width="38" height="38" patternUnits="userSpaceOnUse">
          <rect className="fp-stone-night" width="38" height="38" />
          <path className="fp-stone-night-line" d="M0 37.5h38M37.5 0v38" />
        </pattern>
        <pattern id={`${id}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect className="fp-hatch-bg" width="8" height="8" />
          <path className="fp-hatch-line" d="M0 0v8" />
        </pattern>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" className="fp-glow-in" />
          <stop offset="1" className="fp-glow-out" />
        </radialGradient>
      </defs>
      <g style={{ ["--fp-hatch" as string]: `url(#${id}-hatch)` }} className="fp-scene">
        <g transform={turned ? "rotate(90)" : undefined}>
          <g aria-hidden="true">{drawing}</g>
          {tableShapes}
        </g>
        {words}
      </g>
    </svg>
  );

  if (!interactive) return <div className="fp fp-still">{svg}</div>;
  return (
    <div className="fp">
      <div
        ref={viewportRef}
        className="fp-viewport"
        tabIndex={0}
        role="listbox"
        aria-label={label}
        aria-roledescription="table map"
        aria-describedby={`${id}-help`}
        aria-activedescendant={activeId === null ? undefined : domId(activeId)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onPointerDownCapture={() => (pointer.current = true)}
        onKeyDownCapture={() => (pointer.current = false)}
        onBlur={() => {
          pointer.current = false;
          setActiveId(null);
        }}
      >
        {svg}
      </div>
      <p id={`${id}-help`} className="visually-hidden">
        Use the arrow keys to move between tables, Enter or Space to choose one, and Escape to leave the plan.
      </p>
    </div>
  );
}
