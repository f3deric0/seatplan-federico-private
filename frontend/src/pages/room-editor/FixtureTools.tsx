import { Button, Checkbox, Select } from "../../design/components";
import { ObjectFields, ObjectTextField, OBJECT_DRAG_TYPE } from "./ObjectFields";
import { editFixture, FIXTURE_KINDS, FIXTURE_NAMES } from "./roomObjects";
import type { Room, RoomFixture } from "./roomModel";

interface Props { room: Room; selected: string | null; free: boolean; onFree: (free: boolean) => void; onSelect: (key: string | null) => void; onPlace: (value: string) => void; onChange: (room: Room) => void; onError: (message: string) => void }
export function FixtureTools({ room, selected, free, onFree, onSelect, onPlace, onChange, onError }: Props) {
  const item = room.fixtures.find(f => f.key === selected);
  const update = (patch: Partial<RoomFixture>) => { if (item) onChange(editFixture(room, item.key, patch)); };
  const safe = (patch: Partial<RoomFixture>) => { try { update(patch); } catch (caught) { onError(caught instanceof Error ? caught.message : "Check the fixed element."); } };
  return <div className="room-form">
    <p>Tap an element to add it to the room, then drag it where it goes.</p>
    <div className="room-object-palette">{FIXTURE_KINDS.map(kind => <button type="button" draggable key={kind} onDragStart={event => { event.dataTransfer.setData(OBJECT_DRAG_TYPE, `fixture:${kind}`); event.dataTransfer.effectAllowed = "copy"; }} aria-label={`Place ${FIXTURE_NAMES[kind]}`} onClick={() => onPlace(`fixture:${kind}`)}>{FIXTURE_NAMES[kind]}</button>)}</div>
    <Checkbox label="Free placement (no grid snapping)" checked={free} onChange={e => onFree(e.target.checked)} />
    {room.fixtures.length > 1 && <Select label="Selected fixed element" value={item?.key ?? ""} options={[{ value: "", label: "Choose an element" }, ...room.fixtures.map((f, i) => ({ value: f.key, label: f.label || `${FIXTURE_NAMES[f.kind]} ${i + 1}` }))]} onChange={e => onSelect(e.target.value || null)} />}
    {item && <div key={item.key} className="room-form">
      <ObjectTextField label="Fixture label" value={item.label} maxLength={40} onCommit={label => update({ label })} />
      {item.kind === "awning" && <p>Awning shade applies to outdoor rooms.</p>}
      <details className="room-more">
        <summary>Size, position and shape</summary>
        <div className="room-form">
          <Select label="Fixed element shape" value={item.shape} options={[{ value: "rect", label: "Rectangle" }, { value: "circle", label: "Circle" }]} onChange={e => safe({ shape: e.target.value as RoomFixture["shape"] })} />
          <ObjectFields item={item} onChange={update} />
        </div>
      </details>
      <Button variant="danger" onClick={() => { onChange({ ...room, fixtures: room.fixtures.filter(f => f.key !== item.key) }); onSelect(null); }}>Remove fixed element</Button>
    </div>}
  </div>;
}
