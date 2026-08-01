import { describe, it, expect } from "vitest"
import { windowSlice } from "./window.js"

const items = Array.from({ length: 20 }, (_, i) => i)

describe("windowSlice", () => {
  it("returns everything when it already fits", () => {
    expect(windowSlice([1, 2, 3], 0, 10)).toEqual({
      items: [1, 2, 3],
      offset: 0,
    })
  })

  it("centres the selection once there are more items than rows", () => {
    const { items: visible, offset } = windowSlice(items, 10, 5)
    expect(visible).toHaveLength(5)
    expect(visible).toContain(10)
    expect(offset).toBe(8)
  })

  it("clamps at the top rather than scrolling past it", () => {
    expect(windowSlice(items, 0, 5).offset).toBe(0)
  })

  it("clamps at the bottom, so the last row stays reachable", () => {
    const { items: visible, offset } = windowSlice(items, 19, 5)
    expect(offset).toBe(15)
    expect(visible.at(-1)).toBe(19)
  })

  it("survives an empty list and a zero-height window", () => {
    expect(windowSlice([], 0, 5)).toEqual({ items: [], offset: 0 })
    expect(windowSlice(items, 3, 0)).toEqual({ items: [], offset: 0 })
  })
})
