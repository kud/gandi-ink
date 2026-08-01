// Pad AND truncate to an exact width. padEnd alone only ever grows a string, so
// any value longer than its column silently runs into the next one — a redirect
// target like "https://www.airbnb.fr/users/show/648382" pushes the type column
// off the row entirely. Every fixed-width column wants this, not padEnd.
export const fit = (text: string, width: number): string => {
  if (width <= 0) return ""
  if (text.length < width) return text.padEnd(width)
  return width === 1 ? " " : `${text.slice(0, width - 2)}… `
}
