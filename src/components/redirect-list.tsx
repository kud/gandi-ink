import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import type { WebRedir } from "@kud/gandi"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"

export type RedirectListProps = {
  redirects: WebRedir[]
  selected?: number
  rows: number
  emptyText?: string
}

// `host` arrives fully qualified from the API. Rendering it verbatim is the
// whole point: appending the domain here is what produced "trakt.kud.io.kud.io"
// in the CLI's table, and that doubled suffix hid the bug for months.
export const RedirectList = ({
  redirects,
  selected = -1,
  rows,
  emptyText = "No web redirects",
}: RedirectListProps) => {
  if (!redirects.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items: visible, offset } = windowSlice(
    redirects,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((redirect, i) => {
        const idx = offset + i
        return (
          <SelectableRow key={redirect.host} active={idx === selected}>
            <Text wrap="truncate-end">
              <Text bold>{fit(redirect.host, 30)}</Text>
              <Text color={colors.accent}>{fit(redirect.type, 9)}</Text>
              <Text color={colors.muted}>{fit("→", 2)}</Text>
              <Text color={colors.info}>{redirect.url ?? "—"}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
