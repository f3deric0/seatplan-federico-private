import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Checkbox, Field, Select } from "../../design/components";
import { sideLength } from "./geometry";
import type { Room, RoomOpening } from "./roomModel";
import { RoomNumberField } from "./ShapeTools";
import type { ShapeSelection } from "./ShapeTools";
import { AroundRoom } from "./AroundRoom";
import { addOpening, mainEntrance, markMainEntrance, openingBearing, setMainEntrance, updateOpening, VIEW_TAGS } from "./wallModel";

interface Props { room: Room; selection: ShapeSelection; selected: string | null; onSelect: (key: string | null) => void; onSide: (selection: ShapeSelection) => void; onChange: (room: Room) => void; onError: (message: string) => void }
export function WallTools({ room, selection, selected, onSelect, onSide, onChange, onError }: Props) {
  const side = selection?.kind === "side" && selection.index < room.outline.points.length ? selection.index : 0;
  const opening = room.openings.find(o => o.key === selected);
  const apply = (change: () => Room) => { try { onChange(change()); } catch (caught) { onError(caught instanceof Error ? caught.message : "Check the opening."); } };
  const entrance = mainEntrance(room);
  const [entranceWall, setEntranceWall] = useState(String(entrance?.side ?? side)), [entranceError, setEntranceError] = useState("");
  return <div className="room-form">
    <section className="room-entrance" aria-labelledby="room-entrance-title">
      <h3 id="room-entrance-title">Main entrance</h3>
      <Select label="Wall of the main entrance" value={entranceWall} options={room.outline.points.map((_, i) => ({ value: String(i), label: `Wall ${i + 1}` }))} onChange={e => { setEntranceWall(e.target.value); setEntranceError(""); }} />
      <Button variant={entrance ? "secondary" : "primary"} disabled={entrance?.side === Number(entranceWall)} onClick={() => {
        try { const next = setMainEntrance(room, Number(entranceWall)); setEntranceError(""); onChange(next); onSelect(mainEntrance(next)!.key); }
        catch (caught) { setEntranceError(caught instanceof Error ? caught.message : "Check the wall."); }
      }}>{entrance ? "Move main entrance here" : "Set main entrance"}</Button>
      {entranceError && <p role="alert" className="room-error">{entranceError}</p>}
    </section>
    <AroundRoom room={room} side={side} onSide={index => onSide({ kind: "side", index })} onChange={onChange} />
    <h3>Add on Wall {side + 1}</h3>
    {(["window", "door"] as const).map(kind => <Button key={kind} variant="secondary" onClick={() => apply(() => { const next = addOpening(room, side, kind); onSelect(next.openings.at(-1)!.key); return next; })}>{kind === "window" ? "Add window" : "Add door"}</Button>)}
    <Select label="Selected opening" value={opening?.key ?? ""} options={[{ value: "", label: "Choose an opening" }, ...room.openings.map((o, i) => ({ value: o.key, label: `${o.kind === "glass_wall" ? "Glass wall" : o.kind === "door" ? "Door" : "Window"} ${i + 1} · Wall ${o.side + 1}${o.is_main_entrance ? " · Main entrance" : ""}` }))]} onChange={e => onSelect(e.target.value || null)} />
    {opening && <OpeningFields key={opening.key} room={room} opening={opening} onMainEntrance={on => apply(() => on ? markMainEntrance(room, opening.key) : updateOpening(room, opening.key, { is_main_entrance: false }))} onUpdate={change => apply(() => updateOpening(room, opening.key, change))} onNumberUpdate={change => { try { onChange(updateOpening(room, opening.key, change)); } catch (caught) { onError(caught instanceof Error ? caught.message : "Check the opening."); throw caught; } }} />}
    {opening && <Button variant="danger" onClick={() => { onChange({ ...room, openings: room.openings.filter(o => o.key !== opening.key) }); onSelect(null); }}>Remove opening</Button>}
  </div>;
}

function OpeningFields({ room, opening: o, onMainEntrance, onUpdate, onNumberUpdate }: { room: Room; opening: RoomOpening; onMainEntrance: (on: boolean) => void; onUpdate: (change: Partial<RoomOpening>) => void; onNumberUpdate: (change: Partial<RoomOpening>) => void }) {
  const { venueId = "" } = useParams();
  let direction: number | null = null, validWall = true;
  try { direction = openingBearing(room, o); } catch { validWall = false; }
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return <>
    <h3>{o.kind === "door" ? "Door" : o.kind === "glass_wall" ? "Glass wall" : "Window"} properties</h3>
    {o.kind !== "glass_wall" && <>
      <RoomNumberField label="Opening width (cm)" value={o.width} min={40} max={sideLength(room.outline, o.side) - o.offset} onCommit={width => onNumberUpdate({ width })} />
    </>}
    {o.kind === "glass_wall" && <p>Width: {Math.round(o.width)} cm · Entire wall</p>}
    {o.kind === "door" ? <Checkbox label="This door is the main entrance" checked={o.is_main_entrance} onChange={e => onMainEntrance(e.target.checked)} /> : <>
      <RoomNumberField label="Window top height (cm)" value={o.top_height} min={100} max={500} onCommit={top_height => onNumberUpdate({ top_height })} />
      <p>{!validWall ? "Check the wall geometry first" : direction === null ? "Set north first" : `Faces ${names[Math.round(direction / 45) % 8]} (${Math.round(direction) % 360}°)`}</p>
      <Field label="View" value={o.view_text} maxLength={80} onChange={e => onUpdate({ view_text: e.target.value })} />
      <fieldset className="room-view-tags"><legend>View tags (up to 3)</legend>{VIEW_TAGS.map(tag => <Checkbox key={tag} label={tag} checked={o.view_tags.includes(tag)} disabled={o.view_tags.length >= 3 && !o.view_tags.includes(tag)} onChange={e => onUpdate({ view_tags: e.target.checked ? [...o.view_tags, tag] : o.view_tags.filter(t => t !== tag) })} />)}</fieldset>
      <Field label="View at night" value={o.night_view_text} maxLength={80} onChange={e => onUpdate({ night_view_text: e.target.value })} />
      {o.id === null ? <p>Save the rooms before adding a view photo.</p> : <Link to={`/owner/${encodeURIComponent(venueId)}/photos?opening=o${o.id}`}>Edit view photo</Link>}
      <Select label="Sun" value={o.sun_rule} options={[{ value: "auto", label: "Work it out for me" }, { value: "never", label: "Never gets direct sun" }, { value: "between", label: "Only between" }]} onChange={e => onUpdate({ sun_rule: e.target.value as RoomOpening["sun_rule"], ...(e.target.value === "between" ? { sun_from: o.sun_from ?? "12:00", sun_until: o.sun_until ?? "16:00" } : { sun_from: null, sun_until: null }) })} />
      {o.sun_rule === "between" && <SunTimes opening={o} onUpdate={onUpdate} />}
    </>}
  </>;
}

function SunTimes({ opening, onUpdate }: { opening: RoomOpening; onUpdate: (change: Partial<RoomOpening>) => void }) {
  const [from, setFrom] = useState(opening.sun_from ?? ""), [until, setUntil] = useState(opening.sun_until ?? "");
  useEffect(() => { setFrom(opening.sun_from ?? ""); setUntil(opening.sun_until ?? ""); }, [opening.sun_from, opening.sun_until]);
  return <><Field label="Sun from" type="time" value={from} onChange={e => setFrom(e.target.value)} onBlur={() => onUpdate({ sun_from: from, sun_until: until })} /><Field label="Sun until" type="time" value={until} onChange={e => setUntil(e.target.value)} onBlur={() => onUpdate({ sun_from: from, sun_until: until })} /></>;
}
