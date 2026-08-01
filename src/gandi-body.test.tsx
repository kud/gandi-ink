import { test, expect } from "vitest"
import { render } from "ink-testing-library"
import { GandiBody } from "./gandi-body.js"

test("renders a non-empty frame", () => {
  const { lastFrame } = render(<GandiBody onExit={() => {}} />)
  expect(lastFrame()?.trim().length).toBeGreaterThan(0)
})

test("calls onExit when q is pressed", () => {
  let exited = false
  const { stdin } = render(<GandiBody onExit={() => (exited = true)} />)
  stdin.write("q")
  expect(exited).toBe(true)
})
