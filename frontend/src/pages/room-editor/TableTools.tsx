import { Button, Checkbox, Select } from "../../design/components";
import type { Room, RoomSeat, RoomTable } from "./roomModel";
import { ObjectFields, ObjectTextField, OBJECT_DRAG_TYPE } from "./ObjectFields";
import { RoomNumberField } from "./ShapeTools";
import { FixtureIcon } from "./FixtureIcon";
import type { IconKind } from "./FixtureIcon";
import { editChair, editTable, setChairCount, TABLE_KINDS, TABLE_NAMES } from "./tableModel";

interface Props { room: Room; selected: string | null; chair: string | null; onSelect: (key: string | null) => void; onChair: (key: string | null) => void; onPlace: (value: string) => void; onChange: (room: Room) => void; onError: (message: string) => void }
export function TableTools({ room, selected, chair, onSelect, onChair, onPlace, onChange, onError }: Props) {
  const table = room.tables.find(t => t.key === selected), seat = table?.seats.find(s => s.key === chair);
  const update = (patch: Partial<Omit<RoomTable, "id" | "key" | "seats">>) => { if (table) onChange(editTable(room, table.key, patch)); };
  const chairUpdate = (patch: Partial<Omit<RoomSeat, "id" | "key">>) => { if (table && seat) onChange(editChair(room, table.key, seat.key, patch)); };
  const safe = (fn: () => void) => { try { fn(); } catch (caught) { onError(caught instanceof Error ? caught.message : "Check the table."); } };
  return <div className="room-form">
    <p>Tap a table to add it to the room, then drag it where it goes. Its size follows the number of chairs.</p>
    <div className="room-object-palette">{TABLE_KINDS.map(kind => <button type="button" draggable key={kind} onDragStart={event => { event.dataTransfer.setData(OBJECT_DRAG_TYPE, `table:${kind}`); event.dataTransfer.effectAllowed = "copy"; }} aria-label={`Place ${TABLE_NAMES[kind]}`} onClick={() => onPlace(`table:${kind}`)}><svg viewBox="-12 -12 24 24" aria-hidden="true"><FixtureIcon kind={`${kind}_table` as IconKind} size={24} /></svg>{TABLE_NAMES[kind]}</button>)}</div>
    <Select label="Selected table" value={table?.key ?? ""} options={[{ value: "", label: "Choose a table" }, ...room.tables.map(t => ({ value: t.key, label: t.label }))]} onChange={event => { onSelect(event.target.value || null); onChair(null); }} />
    {table && <div key={table.key} className="room-form">
      <ObjectTextField label="Table label" value={table.label} maxLength={40} onCommit={label => update({ label })} />
      <details className="room-more"><summary>Size and position</summary><div className="room-form"><ObjectFields item={table} onChange={update} /></div></details>
      <p>{table.seats.length} chairs</p><div className="room-actions"><Button variant="secondary" aria-label="Remove chair" disabled={table.seats.length <= 1} onClick={() => safe(() => onChange(setChairCount(room, table.key, table.seats.length - 1)))}>−</Button><Button variant="secondary" aria-label="Add chair" disabled={table.seats.length >= 20} onClick={() => safe(() => onChange(setChairCount(room, table.key, table.seats.length + 1)))}>+</Button></div>
      <p>Changing the chair count redistributes the chairs around this table.</p>
      <RoomNumberField label="Minimum party size" value={table.min_party} min={1} max={table.max_party} onCommit={min_party => update({ min_party })} />
      <RoomNumberField label="Maximum party size" value={table.max_party} min={table.min_party} max={table.seats.length} onCommit={max_party => update({ max_party })} />
      <Checkbox label="Wheelchair accessible" checked={table.is_accessible} onChange={e => update({ is_accessible: e.target.checked })} />
      <Checkbox label="Room for a high chair" checked={table.high_chair_ok} onChange={e => update({ high_chair_ok: e.target.checked })} />
      <ObjectTextField label="Can be joined with" value={table.combine_group ?? ""} maxLength={40} onCommit={combine_group => update({ combine_group: combine_group || null })} />
      <Checkbox label="Available for booking" checked={table.is_active} onChange={e => update({ is_active: e.target.checked })} />
      <Select label="Table zone" value={table.zone_key ?? ""} options={[{ value: "", label: "No zone" }, ...room.zones.map(z => ({ value: z.key, label: z.name }))]} onChange={e => update({ zone_key: e.target.value || null })} />
      <Select label="Selected chair" value={seat?.key ?? ""} options={[{ value: "", label: "Choose a chair" }, ...table.seats.map(s => ({ value: s.key, label: s.label }))]} onChange={e => onChair(e.target.value || null)} />
      {seat && <div key={seat.key} className="room-form"><h3>Chair properties</h3>
        <ObjectTextField label="Chair label" value={seat.label} maxLength={40} onCommit={label => chairUpdate({ label })} />
        <RoomNumberField label="Chair x (cm)" value={seat.x} onCommit={x => chairUpdate({ x })} /><RoomNumberField label="Chair y (cm)" value={seat.y} onCommit={y => chairUpdate({ y })} />
        <Checkbox label="Chair accessible" checked={seat.is_accessible} onChange={e => chairUpdate({ is_accessible: e.target.checked })} /><Checkbox label="Chair blocked" checked={seat.is_blocked} onChange={e => chairUpdate({ is_blocked: e.target.checked })} />
      </div>}
    </div>}
  </div>;
}
