import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FixtureTools } from "./FixtureTools";
import { createRoom } from "./roomModel";
import { addFixture } from "./roomObjects";
import type { Room } from "./roomModel";

const show = (room: Room, selected: string | null = null, free = false) => {
  const onPlace = vi.fn(), onSelect = vi.fn(), onChange = vi.fn(), onFree = vi.fn();
  render(<FixtureTools room={room} selected={selected} free={free} onFree={onFree} onSelect={onSelect} onPlace={onPlace} onChange={onChange} onError={vi.fn()} />);
  return { onPlace, onSelect, onChange, onFree };
};
const empty = () => createRoom("Room 1", 1000, 700);

it("adds an element with one tap and offers no second step", () => {
  const { onPlace } = show(empty());
  fireEvent.click(screen.getByRole("button", { name: "Place Bar" }));
  expect(onPlace).toHaveBeenCalledWith("fixture:bar");
  expect(screen.queryByRole("button", { name: "Place selected in room" })).toBeNull();
});

it("shows only the name and Remove for a chosen element, with size, position and shape tucked away", () => {
  const room = addFixture(empty(), "bar", { x: 100, y: 100 });
  show(room, room.fixtures[0].key);
  expect(screen.getByLabelText("Fixture label")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove fixed element" })).toBeTruthy();
  const more = document.querySelector<HTMLDetailsElement>("details.room-more")!;
  expect(more.open).toBe(false);
  expect(more.textContent).toContain("Size, position and shape");
  expect(more.querySelector("input")).not.toBeNull();
});

it("lists the elements to choose from only when there are two or more", () => {
  const one = addFixture(empty(), "bar", { x: 100, y: 100 });
  const { onSelect } = show(one);
  expect(screen.queryByLabelText("Selected fixed element")).toBeNull();
  const two = addFixture(one, "plant", { x: 300, y: 300 });
  const second = render(<FixtureTools room={two} selected={null} free={false} onFree={vi.fn()} onSelect={onSelect} onPlace={vi.fn()} onChange={vi.fn()} onError={vi.fn()} />);
  expect(second.getByLabelText("Selected fixed element")).toBeTruthy();
});

it("mentions awning shade only for an awning", () => {
  const room = addFixture(empty(), "awning", { x: 100, y: 100 });
  show(room, room.fixtures[0].key);
  expect(screen.getByText("Awning shade applies to outdoor rooms.")).toBeTruthy();
});

it("offers free placement as a switch that starts off", () => {
  const { onFree } = show(empty());
  const box = screen.getByLabelText<HTMLInputElement>("Free placement (no grid snapping)");
  expect(box.checked).toBe(false);
  fireEvent.click(box);
  expect(onFree).toHaveBeenCalledWith(true);
});
