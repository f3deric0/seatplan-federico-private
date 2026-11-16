import { useState } from "react";
import { useParams } from "react-router-dom";
import { getOwnerProfile } from "../../api/owner";
import { Button, Checkbox, Select } from "../../design/components";
import { findNearby } from "../../maps/nearbyFeatures";
import type { NearFeature } from "../../maps/nearbyFeatures";
import type { Room } from "./roomModel";
import { directionWord, setSurrounding, setTerrace, SURROUNDINGS, surroundingOf, terraceOn, wallFacing } from "./surroundings";
import type { SurroundingKind } from "./surroundings";

type Suggestions = { status: "idle" } | { status: "loading" } | { status: "no-pin" } | { status: "failed" } | { status: "ready"; found: NearFeature[] };
const NAMES: Record<NearFeature["kind"], string> = { sea: "The sea", river: "A river", park: "A park" };

/** Say what is outside each wall: it is drawn on the plan, diners read it, and the restaurant's location suggests it. */
export function AroundRoom({ room, onChange }: { room: Room; onChange: (room: Room) => void }) {
  const { venueId = "" } = useParams();
  const [wall, setWall] = useState("0"), [error, setError] = useState(""), [suggestions, setSuggestions] = useState<Suggestions>({ status: "idle" });
  const side = Math.min(Number(wall), Math.max(0, room.outline.points.length - 1));
  const apply = (target: number, kind: SurroundingKind | null) => {
    try { onChange(setSurrounding(room, target, kind)); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Check the wall."); }
  };
  const suggest = async () => {
    setSuggestions({ status: "loading" });
    try {
      const profile = await getOwnerProfile(venueId);
      if (profile.lat === null || profile.lng === null) { setSuggestions({ status: "no-pin" }); return; }
      setSuggestions({ status: "ready", found: await findNearby(profile.lat, profile.lng) });
    } catch { setSuggestions({ status: "failed" }); }
  };
  return <section className="room-around" aria-labelledby="room-around-title">
    <h3 id="room-around-title">Around the room</h3>
    <p>What is outside a wall, and is there a terrace? It is drawn on the plan, and diners read it.</p>
    <Select label="Wall" value={String(side)} options={room.outline.points.map((_, i) => ({ value: String(i), label: `Wall ${i + 1}` }))} onChange={e => { setWall(e.target.value); setError(""); }} />
    <Select label="What is outside" value={surroundingOf(room, side)?.kind ?? ""} options={[{ value: "", label: "Nothing in particular" }, ...SURROUNDINGS.map(s => ({ value: s.kind, label: s.label }))]} onChange={e => apply(side, (e.target.value || null) as SurroundingKind | null)} />
    <Checkbox label="Terrace outside this wall" checked={terraceOn(room, side) !== null} onChange={e => { try { onChange(setTerrace(room, side, e.target.checked)); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Check the wall."); } }} />
    {terraceOn(room, side) && <p>Guests can sit on the terrace: place tables there from the Tables tab.</p>}
    {error && <p role="alert" className="room-error">{error}</p>}
    <Button variant="secondary" busy={suggestions.status === "loading"} onClick={() => void suggest()}>Suggest from my location</Button>
    {suggestions.status === "no-pin" && <p role="status">Place the pin on the map in your restaurant's profile first, and we can suggest what is around it.</p>}
    {suggestions.status === "failed" && <p role="status">Could not look around your location just now. You can still choose by hand.</p>}
    {suggestions.status === "ready" && suggestions.found.length === 0 && <p role="status">Nothing notable within a short walk (600 m): no sea, river or park. You can still choose by hand.</p>}
    {suggestions.status === "ready" && suggestions.found.length > 0 && <ul className="room-around-list" aria-label="Suggestions">
      {suggestions.found.map(item => {
        const facing = item.bearing === null ? null : wallFacing(room, item.bearing);
        return <li key={item.kind}>
          <span>{NAMES[item.kind]}, {item.bearing === null ? "right where you are" : `about ${item.metres} m to the ${directionWord(item.bearing)}`}.</span>
          {facing && <Button variant="secondary" onClick={() => { setWall(String(facing.side)); apply(facing.side, item.kind); }}>{`Put it on Wall ${facing.side + 1}`}</Button>}
        </li>;
      })}
    </ul>}
  </section>;
}
