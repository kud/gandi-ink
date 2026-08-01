import { Box, Text, useInput } from "ink"

export type GandiBodyProps = {
  /** Called when the user quits. The host owns the terminal lifecycle. */
  onExit: () => void
}

// Placeholder body — replaced by the assembled domain/DNS/redirect browser.
// Kept presentation-only from the start: no render(), no terminal ownership,
// quitting reported through onExit so a host can mount this as one component.
export const GandiBody = ({ onExit }: GandiBodyProps) => {
  useInput((input) => {
    if (input === "q") onExit()
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan" bold>
        @kud/gandi-ink
      </Text>
      <Text dimColor>Placeholder — press q to quit.</Text>
    </Box>
  )
}
