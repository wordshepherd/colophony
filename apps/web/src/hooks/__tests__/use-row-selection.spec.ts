import { renderHook, act } from "@testing-library/react";
import { useRowSelection } from "../use-row-selection";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("useRowSelection", () => {
  it("toggles single item", () => {
    const { result } = renderHook(() => useRowSelection());

    expect(result.current.count).toBe(0);
    expect(result.current.isSelected("a")).toBe(false);

    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("toggleAll selects all when none selected", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggleAll(items));

    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.isSelected("c")).toBe(true);
    expect(result.current.count).toBe(3);
  });

  it("toggleAll deselects when all selected", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggleAll(items));
    expect(result.current.count).toBe(3);

    act(() => result.current.toggleAll(items));
    expect(result.current.count).toBe(0);
  });

  it("isIndeterminate for partial selection", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggle("a"));

    expect(result.current.isIndeterminate(items)).toBe(true);
    expect(result.current.isAllSelected(items)).toBe(false);
  });

  it("clear empties selection", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggleAll(items));
    expect(result.current.count).toBe(3);

    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
    expect(result.current.isSelected("a")).toBe(false);
  });
});
