import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import type { Domain } from "@kud/gandi"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"

export type DomainListProps = {
  domains: Domain[]
  selected?: number
  rows: number
  emptyText?: string
}

const DAY = 24 * 60 * 60 * 1000

// Expiry is the one number worth reading at a glance, so it is rendered as a
// countdown rather than a date. The tone thresholds are deliberate: a domain is
// renewable long before it lapses, so 30 days is a nudge and 7 days is alarming.
const expiryTone = (days: number): string =>
  days <= 7 ? colors.error : days <= 30 ? colors.warning : colors.muted

const expiryLabel = (at?: string, now = Date.now()): [string, string] => {
  if (!at) return ["—", colors.muted]
  const days = Math.ceil((new Date(at).getTime() - now) / DAY)
  if (Number.isNaN(days)) return ["—", colors.muted]
  return days < 0
    ? [`expired ${-days}d ago`, colors.error]
    : [`${days}d`, expiryTone(days)]
}

export const DomainList = ({
  domains,
  selected = -1,
  rows,
  emptyText = "No domains",
}: DomainListProps) => {
  if (!domains.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items: visible, offset } = windowSlice(
    domains,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((domain, i) => {
        const idx = offset + i
        const [expiry, tone] = expiryLabel(domain.dates?.registry_ends_at)
        // Autorenew carries a glyph as well as a colour: on a monochrome
        // terminal "on" and "off" must still be distinguishable.
        const auto = domain.autorenew ? "↻ auto" : "· manual"
        return (
          <SelectableRow key={domain.fqdn ?? idx} active={idx === selected}>
            <Text wrap="truncate-end">
              <Text bold>{fit(domain.fqdn ?? "—", 32)}</Text>
              <Text color={tone}>{fit(expiry, 16)}</Text>
              <Text color={domain.autorenew ? colors.success : colors.muted}>
                {auto}
              </Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
