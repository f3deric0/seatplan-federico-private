import { describe, expect, it } from "vitest";
import { WheelGesture } from "./wheelZoom";

describe("one scroll gesture is one zoom level", () => {
  it("zooms once for a whole trackpad stream, however long it runs", () => {
    const gesture = new WheelGesture();
    const steps: number[] = [];
    for (let t = 0, delta = -30; t < 1200; t += 16, delta = Math.min(-2, delta + 0.4)) steps.push(gesture.step(delta, t)); // a swipe fading out
    expect(steps.filter(Boolean)).toEqual([1]);
  });

  it("zooms again after the stream has gone quiet, and in the direction of the new gesture", () => {
    const gesture = new WheelGesture();
    expect(gesture.step(-40, 0)).toBe(1);
    expect(gesture.step(-20, 16)).toBe(0);
    expect(gesture.step(60, 600)).toBe(-1); // a new swipe the other way
  });

  it("counts each notch of a mouse wheel, and ignores noise", () => {
    const gesture = new WheelGesture();
    expect(gesture.step(-100, 0)).toBe(1);
    expect(gesture.step(-100, 300)).toBe(1);
    expect(gesture.step(-1, 900)).toBe(0);
  });

  it("treats a clearly bigger push in the middle of a stream as a new gesture", () => {
    const gesture = new WheelGesture();
    expect(gesture.step(-10, 0)).toBe(1);
    expect(gesture.step(-8, 20)).toBe(0);
    expect(gesture.step(-90, 60)).toBe(1);
  });
});
