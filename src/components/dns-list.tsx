import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import type { DnsRecord } from "@kud/gandi"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"

export type DnsListProps = {
  records: DnsRecord[]
  selected?: number
  rows: number
  emptyText?: string
}

// An rrset holds several values; the row shows them joined rather than one row
// per value, because the record is what you act on — deleting "the A record"
// deletes the set, and a row per value would imply otherwise.
const joinValues = (values: string[] = []): string => values.join(", ")

export const DnsList = ({
  records,
  selected = -1,
  rows,
  emptyText = "No DNS records",
}: DnsListProps) => {
  if (!records.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items: visible, offset } = windowSlice(
    records,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((record, i) => {
        const idx = offset + i
        return (
          <SelectableRow
            key={`${record.rrset_name}/${record.rrset_type}`}
            active={idx === selected}
          >
            <Text wrap="truncate-end">
              <Text bold>{fit(record.rrset_name, 24)}</Text>
              <Text color={colors.accent}>{fit(record.rrset_type, 8)}</Text>
              <Text color={colors.muted}>{fit(`${record.rrset_ttl}s`, 8)}</Text>
              <Text color={colors.info}>{joinValues(record.rrset_values)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
