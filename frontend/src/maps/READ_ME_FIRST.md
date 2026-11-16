# Location maps

LeafletMap loads only when a location form opens. Leaflet is pinned to 1.9.4.
It uses the standard HTTPS OpenStreetMap tile URL with visible attribution.
There is no bulk downloading or server-side proxy. The only address lookup is reverseGeocode.ts, used by the
owner's location form: one OpenStreetMap Nominatim reverse request, made after a pin is placed (debounced) or when
the owner clicks "Fill address from pin". It never overwrites an address the owner typed unless they click the
button, and a failure leaves the field for typing. The production CSP (vercel.json, connect-src 'self') must allow
https://nominatim.openstreetmap.org before this works on the live site; that is a deployment decision for Martim.
Tiles follow normal browser caching and override the page referrer policy
with strict-origin-when-cross-origin, sending only the site origin to OSM.

The map starts in Lisbon at zoom 13. Clicking places a draggable div-icon pin.
The controlled point and coordinate fields stay in sync. Without tiles, fields
still work. Geolocation belongs to the form and is requested only on a click.
The map cleans up its Leaflet instance on unmount. Numeric fields provide the
keyboard alternative to clicking/dragging. No device location is requested by
this component.

Sources: https://leafletjs.com/reference-1.9.4.html and
https://operations.osmfoundation.org/policies/tiles/ . The actual hosted
Referer/CSP behavior still needs a deployment check; no deployment is authorized.

ResultsMap supplies the public discovery and restaurant maps. Leaflet positions
the pins and canvases. DiscoveryBasemap draws the land, water, parks, buildings
and roads from OpenFreeMap vector tiles. It requests only visible tiles, aborts
requests when Leaflet unloads them and omits labels. The public page footer
credits OpenMapTiles and OpenStreetMap. When tiles fail, the numbered diagram
and the list still give diners access to the results.
