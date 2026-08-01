// Visible slice that keeps the selected row in view (centred when it can be),
// plus the offset of the first visible item. Windowing lives here so every list
// component scrolls identically. The parent still owns the selection index —
// this is pure maths, no state.
export const windowSlice = <T>(
  items: T[],
  selected: number,
  rows: number,
): { items: T[]; offset: number } => {
  if (rows <= 0 || items.length === 0) return { items: [], offset: 0 }
  if (items.length <= rows) return { items, offset: 0 }

  const offset = Math.max(
    0,
    Math.min(selected - Math.floor(rows / 2), items.length - rows),
  )
  return { items: items.slice(offset, offset + rows), offset }
}
