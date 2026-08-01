// @kud/gandi-ink — Ink components for browsing Gandi domains, DNS records and
// web redirects. The list components are presentation-only: props in, no data
// fetching, no app-level input, so they compose into a full-screen CLI or a
// single pane in a larger dashboard alike.
export { DomainList, type DomainListProps } from "./components/domain-list.js"
export { DnsList, type DnsListProps } from "./components/dns-list.js"
export {
  RedirectList,
  type RedirectListProps,
} from "./components/redirect-list.js"

// Pure helpers, exported so a host composing its own lists scrolls and pads
// identically rather than reimplementing either.
export { windowSlice } from "./lib/window.js"
export { fit } from "./lib/fit.js"

// The assembled interactive browser. Embeddable: it does not own the terminal
// or call render(), reporting quit through the required onExit callback, so a
// host — the CLI, a dashboard pane — mounts it as one component and keeps the
// terminal lifecycle to itself.
export { GandiBody, type GandiBodyProps } from "./gandi-body.js"
