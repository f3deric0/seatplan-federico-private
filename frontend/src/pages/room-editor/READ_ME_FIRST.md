# Restaurant room editor

This editor owns restaurant rooms and uses centimetres with screen y down.
The event editor remains the compatibility reference. Only its existing
useHistory and useUnsavedGuard hooks are imported when the UI is introduced.

roomModel.ts defines the nested room payload and immutable room operations.
Every added item has a browser key of at most 39 characters, with a nullable
database id. Persisted ids must be preserved when moving and editing items.

geometry.ts matches the Python ambience geometry. Clockwise outlines have
positive signed area. Each point's curve is the signed outgoing sagitta.
The polygon uses 16 segments per circular side by default. Boundary points
are inside. Server validation remains authoritative at save and publish.

Why immutable values? Each history entry can retain the previous object.
Why room-local coordinates? Each room has independent walls and orientation.
Why two geometry implementations? Browser gestures and server validation need
the same conventions. Known reference cases are tested in both languages.

Run npm test -- src/pages/room-editor/geometry.test.ts and npm run typecheck.

RoomEditorPage starts the room history and accessible properties. RoomCanvas
uses the shared pan/zoom hook, centimetre grid and rulers. NewRoomDialog and
shapeModel create rectangles, L-shaped rooms and freehand outlines. Every
gesture for adding a corner also has x/y fields and a button. The legacyRoom
adapter reads the existing flat restaurant layout into an implicit Main room
without changing any database id. The later persistence tasks replace that
bootstrap with the dedicated versioned room API.

shapeEditing.ts edits corners and circular sides without changing prior history.
Splitting an arc keeps both halves on the original circle. A split across an
opening or a removal beside an opening is refused until the opening is moved.
The owner sees that explanation rather than losing window data. Drawing ignores
repeat taps and finishOutline normalises winding and remaps opening offsets.

ShapeHandles provides 44px pointer targets independent of zoom. One drag is one
history step. A single midpoint tap adds a corner after the double-tap interval;
a double tap straightens the wall. RoomProperties exposes the same edits as
forms, with decimal comma or point and visible validation errors. SVG paths use
true circular A segments. The properties heading receives focus without
scrolling the canvas away during a drag.

wallModel.ts creates and validates openings, checks overlap and bounds in arc
centimetres, and computes the bearing from the outward normal at the opening
midpoint. WallTools exposes the same controls as WallLayer's move/resize
handles. Windows have view text, up to three tags, top height and a sun rule;
doors have the entrance flag. Glass occupies the entire side and follows side
length edits. Shape changes which would strand a window beyond the wall are
refused. Opening ids/keys survive edits. Photo attachment joins the upload
and saved-room endpoints in tasks 13/17, after an opening has a database id.

North is always the top of the plan. NorthCompass is a small fixed mark (outlined circle, arrow, N) in the top right
corner of the plan; it is transparent, takes no clicks and never turns, and there is no North tab or field. New rooms
get north_deg 0, and the editor opens every room through withNorthUp, so a room the server holds with another north
(or none) shows as Unsaved until it is saved with north 0. Save replaces north with 0 for every room. The window
directions, the Light tool and the publish check all use that 0. northModel.compassNorth is kept for a future phone
compass, and validation still reports no_north for a room that reaches it without one.
The phone must lie flat and align with the plan; the owner checks the result.
Manual controls remain available when no sensor reading arrives. API reference:
https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent and
https://www.w3.org/TR/orientation-event/ . Physical iOS/Android hardware has
not been tested in this Windows session.

roomObjects.ts owns immutable fixed-element and zone creation/editing. The
eleven fixture kinds and seven new zone kinds are listed there. Existing
stage zones remain readable/editable for compatibility. Circles keep equal
dimensions; changes preserve ids and keys. Removing a zone clears that link
on affected tables and preserves every table. FixtureTools/ZoneTools expose
palettes, placement in the room and position/size/name fields. Palette drag
uses a private MIME type; tap-then-place and the placement button also work.
ObjectLayer draws neutral icons/names and allows one-step drag undo. Zone
rectangles are behind fixtures and tables and are selectable in Zones mode.
Outline containment and overlap warnings are added by task 16; placement can
currently be outside.
All values use centimetres and clockwise screen rotation.

Desktop properties scroll independently within the canvas height, so dragging
from a long palette does not scroll the page out from under the pointer.
Zone names retain the historical 80-character limit, including during moves.

tableModel.ts creates round/square/long/counter tables with the specified sizes
and chair counts. It imports the existing seatPositions helper without changing
it. Counters use the first side of a rectangle with twice the requested count,
so all chairs sit on one long side and span the counter width. Editing geometry
keeps chair ids/labels/flags and rotates custom displacements relative to the
generated chair positions. Changing chair count redistributes chairs explicitly,
retaining the first existing ids/keys and custom labels/flags. Party sizes stay
within the chair count. A room allows 200 tables/1000 chairs; each table 1–20.

TableTools exposes labels, geometry, party bounds, zone, availability, accessibility,
high chair and join group, plus individual chair coordinates/label/flags.
TableLayer selects and drags tables or individual chairs with one history step.
Chair drag uses centimetres, table drag the optional room grid. Inactive tables
have dashed outlines and an (off) label. Accessible/blocked chairs have extra
marks, not only colour. Task 15 adds transforms/multiple selection/shortcuts;
task 17 enforces persisted booking references on the server before deletion.

selection.ts implements table bounds (circles ignore rotation), group movement,
six alignments, even gaps on either axis, duplication with fresh table/seat ids
and keys, conservative deletion, rotation and anchored corner resizing. A
duplicate keeps settings/labels for chairs and gets a unique table copy label.
Negative distribution gaps are refused until the outer tables are further apart.
has_bookings is read-only server metadata: unknown persisted tables cannot be
deleted; task 17 must provide it and strip it from write payloads.

SelectionTools has checkboxes and buttons for every batch action. Shift-click
or a selection area adds tables; touch hold enters multiple mode. Arrows move
1 cm (Shift 10), R rotates 15, Ctrl/Meta+D duplicates, Delete removes selected
tables, Escape clears. Shortcuts ignore form inputs. A selected chair moves by
arrows; Delete asks for the chair-count controls to avoid deleting the table.
TableHandles rotates in 15-degree steps (Alt gives free angles) and resizes from
the opposite anchored corner. Table body hit areas take priority over expanded
chair targets within the body. Touch targets, numeric forms and checkbox lists
provide alternatives; task 20 completes the phone workspace and camera behavior.

validation.ts mirrors ambience/validation.py with known reference cases in both
test suites. validateRooms returns RoomProblem values; publication mode adds
no_north and no_tables. The editor memoizes draft checks on layout changes.
ProblemList lists all rooms, not just the current one, and clicking a problem
selects its target and centres the camera/viewport. Error tables have a red
outline and warning glyph, and invalid outlines are red. Invalid drafts remain
renderable and editable; unfinished outlines offer Continue drawing walls.
SAT checks use actual circles/rotated rectangles; chair-clearance footprints add
45 cm. Circle corners are not treated as rectangle corners. Concave containment
checks boundary crossings as well as centres/corners. Groups allow 2 cm overlap;
touching edges alone have no area overlap. The whole restaurant editor is lazy
loaded so other routes do not load these geometry/interaction modules eagerly.


## Saving and recovery (task 18)

The editor opens what the server has (`GET /api/owner/restaurants/{vid}/rooms`, a
restaurant without rooms arrives as one implicit "Main room") and Save replaces the whole
layout in one request (`api/rooms.ts`, `useRoomDraft.ts`). The request carries the
version the layout was opened at; if another tab or device saved first the server
answers 409 `stale_layout` and changes nothing. The owner's work then stays on screen and
on this device (localStorage `seatplan.room-draft.<venue>`, written 400 ms after each
change, removed on save), with two choices: "Discard mine and load the latest" or "Save
mine over it" (rebased on the latest version; if something it refers to was deleted
elsewhere the server says 404 and the owner is told to load the latest). A draft left from
an earlier visit is offered back ("Restore my changes" / "Discard my changes") and is never
overwritten before that choice. A table with bookings cannot be deleted (409 with its name):
the message points to "Available for booking" instead. Storage errors (private windows) only
mean no local copy; the editor still works.
Final review adds structural checks when reading local drafts: damaged stored
JSON shapes are ignored so the saved server rooms can still open. A room save
that moves a published restaurant to draft explains that new bookings are
closed until the owner fixes the problems and publishes again. Area checks
mirror the server's inclusive 4–5000 m² limits. Server winding normalization
preserves opening positions and curves. The full phone persistence test now
uses real tap actions with hasTouch/isMobile, not mouse clicks at a small width.

## Light tool (task 24)

The "Light" tool previews the SAVED rooms (`GET /api/owner/restaurants/{vid}/ambience-preview`,
asked 250 ms after the date or time stops changing, and again after a save). `lightModel.ts` has the
words and numbers (compass names, "On 21 June at 13:00 the sun is in the south (180°), 74° high.
Sunset at 21:05.", the 06:00-23:45 slider grid, the Sunrise / Lunch 13:00 / Sunset / Dinner 20:30
shortcuts, and the sun's screen direction from the room's north). `LightLayer.tsx` draws striped
sun patches clipped to the room, the dark-blue veil after sunset and the sun on the plan's edge;
it never catches a tap. `LightTools.tsx` is the panel, with a "Describe table" list that shows the
same sentences diners get. It says why nothing is shown (no location, north not set, unsaved
changes) instead of guessing.

The Walls tab starts with the Main entrance block: the owner picks the wall and presses Set main entrance (or Move main
entrance here). setMainEntrance reuses a door already on that wall or adds one where it fits, and markMainEntrance keeps
exactly one door per room flagged. The old main door stays as an ordinary door after a move. WallLayer draws a purple
"Main entrance" tag beside the flagged door, away from its swing. The diner's plan (pages/restaurant/FloorPlan.tsx) draws
the same tag and a purple door; floorPlanScene.entranceTags gives its place and planLayout makes room for it.

The Fixed tool adds an element with one tap: the palette button places it at the centre of the room and selects it
(dragging a button onto the plan still places it where it lands). The chosen element shows its name and Remove; size,
position, rotation and shape sit in a collapsed "Size, position and shape" section, which stays as the keyboard
alternative to dragging. The element list only appears with two or more elements. Palettes show short names
("Bar", "Quiet", "Round table"); their accessible names stay "Place ...".

Fixed elements stay inside the room: editFixture rejects a move, resize or turn that would take one out (validation.fitsInRoom),
unless an older plan already had it outside; a drag stops at a wall and slides along it; an element added or dropped outside
lands on the nearest spot inside (addFixture), centred on the point. They snap to the 50 cm grid unless the Free placement
switch in the Fixed panel is ticked (page state `free`, passed down as `fixtureGrid`). The room floor shows a 50 cm chessboard
(`data-room-checker`, clipped to the outline) so the owner can see where an element will sit.

The Fixed palette offers only a bar, a WC, stairs and a TV (roomObjects.FIXTURE_PALETTE); the other kinds in FIXTURE_KINDS
stay valid so older plans still open, draw and edit. Each element is drawn with a line icon (FixtureIcon) above its name.
A selected element shows eight grips (data-fixture-grip="sx,sy") in ObjectLayer: pulling one keeps the opposite side or
corner fixed, works in the element's own turned frame, snaps sizes to 10 cm unless placement is free, keeps circles round,
never goes below 20 cm and stops where the element would leave the room. The width and height fields stay as the keyboard
alternative.

The grips show only for an element the owner has clicked on the plan (ObjectLayer keeps `gripped`): one just added from the palette, or picked from the list, is selected but has no grips until it is clicked. A click on empty floor in the Fixed or Zones tool lets go of the selection.

A clicked element also shows a rotation grip (data-fixture-rotate) on a stem above its top edge. Dragging it makes the element
face the pointer, in 15 degree steps unless placement is free, and it stops at the last angle that keeps the element in the room.
The Fixed panel has a Rotate 90 degrees button (an inline error says when the turn does not fit) and the rotation field stays as the
keyboard alternative. The icon and name are drawn upright whatever the angle.

