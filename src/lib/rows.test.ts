import { describe, it, expect } from "vitest"
import { listRows } from "./rows.js"

const CHROME = 8

describe("listRows", () => {
  it("gives the list what is left after chrome and overlays", () => {
    expect(listRows(40, CHROME, 0)).toBe(32)
    expect(listRows(40, CHROME, 6)).toBe(26)
  })

  it("falls back when the terminal reports no height at all", () => {
    expect(listRows(undefined, CHROME, 0)).toBe(16)
  })

  // The bug this function exists for. A pty harness reports rows: 0, which `??`
  // preserves as a real height — the list then collapses to a single row while
  // the header still says "4 domains".
  it("treats a reported height of zero as unknown, not as zero", () => {
    expect(listRows(0, CHROME, 0)).toBe(16)
  })

  it("never returns less than one row, however cramped", () => {
    expect(listRows(4, CHROME, 0)).toBe(1)
    expect(listRows(10, CHROME, 20)).toBe(1)
  })
})
