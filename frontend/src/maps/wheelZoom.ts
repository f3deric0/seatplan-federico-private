import type { Map as LeafletMap } from "leaflet";

/*
 * One scroll gesture is one zoom level. A trackpad (or a smooth-scrolling wheel) sends a stream of wheel events for a second or more,
 * and Leaflet's own wheel zoom turns each burst of that stream into another step, so one swipe could zoom three or four levels. Here
 * a stream is one gesture: it zooms once, when it starts, and then waits until it goes quiet. A new push in the middle of a stream
 * (the deltas getting clearly bigger again, as a fast wheel does) counts as a new gesture.
 */
export class WheelGesture {
  private last = -Infinity;
  private size = 0;
  private active = false;

  constructor(private readonly quiet = 160) {}

  /** Which way to zoom for this wheel event: 1 in, -1 out, 0 for none (it belongs to a gesture that already zoomed). */
  step(deltaY: number, time: number): -1 | 0 | 1 {
    const gap = time - this.last, size = Math.abs(deltaY);
    this.last = time;
    if (size < 2) return 0; // noise
    const newPush = this.active && size >= 40 && size >= this.size * 1.5 && gap > 30;
    if (gap > this.quiet || !this.active || newPush) { this.active = true; this.size = size; return deltaY < 0 ? 1 : -1; }
    this.size = size;
    return 0;
  }
}

/** Wheel zoom around the pointer, one level per gesture. Returns the function that takes it away. */
export function wheelZoomOneStep(map: LeafletMap, element: HTMLElement): () => void {
  const gesture = new WheelGesture();
  const onWheel = (event: WheelEvent) => {
    event.preventDefault(); // the page does not scroll while the pointer is over the map
    const direction = gesture.step(event.deltaY, event.timeStamp);
    if (direction === 0) return;
    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Math.round(map.getZoom()) + direction));
    if (zoom !== map.getZoom()) map.setZoomAround(map.mouseEventToContainerPoint(event), zoom);
  };
  element.addEventListener("wheel", onWheel, { passive: false });
  return () => element.removeEventListener("wheel", onWheel);
}
