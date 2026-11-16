import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { NorthCompass } from "./NorthCompass";

const compass = (north: number | null) => {
  const onChange = vi.fn();
  render(<NorthCompass north={north} onChange={onChange} />);
  return { onChange, slider: screen.getByRole("slider", { name: "North direction" }) };
};

it("lets the owner confirm zero degrees when north has not been set", () => {
  const { onChange, slider } = compass(null);
  fireEvent.keyDown(slider, { key: "Home" });
  expect(onChange).toHaveBeenCalledWith(0);
});

it("says where north is, or that it is not set", () => {
  const { slider } = compass(90);
  expect(slider.getAttribute("aria-valuenow")).toBe("90");
  expect(slider.getAttribute("aria-valuetext")).toBe("North is at 90°");
});

it("says north is not set when it has no value", () => {
  const { slider } = compass(null);
  expect(slider.getAttribute("aria-valuenow")).toBeNull();
  expect(slider.getAttribute("aria-valuetext")).toBe("North is not set");
});

it("turns north with the arrow keys, 15 degrees with Shift or Page Up and Down, wrapping around", () => {
  const { onChange, slider } = compass(359);
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(onChange).toHaveBeenLastCalledWith(0);
  fireEvent.keyDown(slider, { key: "ArrowLeft", shiftKey: true });
  expect(onChange).toHaveBeenLastCalledWith(344);
  fireEvent.keyDown(slider, { key: "PageUp" });
  expect(onChange).toHaveBeenLastCalledWith(14);
  fireEvent.keyDown(slider, { key: "PageDown" });
  expect(onChange).toHaveBeenLastCalledWith(344);
});

it("clears north with Delete and ignores other keys", () => {
  const { onChange, slider } = compass(120);
  fireEvent.keyDown(slider, { key: "Delete" });
  expect(onChange).toHaveBeenLastCalledWith(null);
  onChange.mockClear();
  fireEvent.keyDown(slider, { key: "a" });
  expect(onChange).not.toHaveBeenCalled();
});

it("commits the angle once, when the drag is released", () => {
  const { onChange } = compass(null);
  const svg = document.querySelector(".room-compass svg")!;
  fireEvent.pointerDown(svg, { clientX: 0, clientY: -100, pointerId: 1 });
  fireEvent.pointerMove(svg, { clientX: 100, clientY: 0, pointerId: 1 });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.pointerUp(svg, { clientX: 100, clientY: 0, pointerId: 1 });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(90);
});
