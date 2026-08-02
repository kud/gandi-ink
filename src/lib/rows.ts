// Rows available to the list, once the chrome and any overlay have taken their
// share. Split out as a pure function because the interesting cases are the
// degenerate ones, and they cannot be reproduced by rendering: a pty harness,
// and some CI and multiplexer contexts, report `rows: 0` rather than omitting
// it, while a test renderer omits it entirely. Treating that zero as a real
// height collapses the list to one row while the header still reports the full
// count — a screen that looks correct and is quietly missing most of its data.
export const listRows = (
  terminalRows: number | undefined,
  chromeRows: number,
  overlayRows: number,
  fallbackRows = 24,
): number =>
  Math.max(1, (terminalRows || fallbackRows) - chromeRows - overlayRows)
