import { describe, it, expect } from "vitest"
import { Box } from "ink"
import { render } from "ink-testing-library"
import { RedirectList } from "./redirect-list.js"
import { fit } from "../lib/fit.js"

// A row long enough to overflow its container is what makes misalignment show:
// with only short values every column already fits and the test passes while
// the bug survives. The narrow wrapper is what forces the overflow, so it is
// load-bearing rather than incidental.
const WIDTH = 60

const REDIRECTS = [
  { host: "a.kud.io", type: "http301", url: "https://short.example" },
  {
    host: "a-very-long-subdomain-name-indeed.kud.io",
    type: "http302",
    url: "https://www.airbnb.fr/users/show/648382?with=a&long=querystring",
  },
  { host: "b.kud.io", type: "cloak", url: "https://x.example" },
]

describe("RedirectList alignment", () => {
  it("keeps the type column at the same offset however long the host is", () => {
    const { lastFrame } = render(
      <Box width={WIDTH}>
        <RedirectList redirects={REDIRECTS} selected={0} rows={10} />
      </Box>,
    )

    const lines = (lastFrame() ?? "").split("\n").filter((l) => l.trim())
    const offsets = lines.map(
      (line) =>
        line.match(/^\s*[❯ ]\s*\S.*?(?=http301|http302|cloak)/)?.[0].length ??
        -1,
    )

    expect(offsets.every((offset) => offset > 0)).toBe(true)
    expect(new Set(offsets).size).toBe(1)
  })
})

describe("fit", () => {
  it("pads a short value to the exact column width", () => {
    expect(fit("ab", 6)).toBe("ab    ")
    expect(fit("ab", 6)).toHaveLength(6)
  })

  it("truncates an over-long value instead of overflowing the column", () => {
    expect(fit("abcdefghij", 6)).toHaveLength(6)
    expect(fit("abcdefghij", 6)).toContain("…")
  })

  it("never returns more characters than the column allows", () => {
    for (const width of [1, 2, 5, 20]) {
      expect(fit("a".repeat(50), width)).toHaveLength(width)
    }
  })

  it("returns nothing for a zero or negative width", () => {
    expect(fit("abc", 0)).toBe("")
    expect(fit("abc", -3)).toBe("")
  })
})
