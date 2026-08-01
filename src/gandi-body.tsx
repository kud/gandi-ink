import { useEffect, useState } from "react"
import { Box, Text, useInput } from "ink"
import {
  FooterHints,
  Select,
  Spinner,
  StatusMessage,
  Tabs,
  TextInput,
  colors,
  type TabItem,
} from "@kud/ink-ui"
import {
  gandiAPI,
  getApiKey,
  type DnsRecord,
  type Domain,
  type GandiAPI,
  type WebRedir,
} from "@kud/gandi"
import { DomainList } from "./components/domain-list.js"
import { DnsList } from "./components/dns-list.js"
import { RedirectList } from "./components/redirect-list.js"

export type GandiBodyProps = {
  /** Called when the user quits. The host owns the terminal lifecycle. */
  onExit: () => void
  /**
   * An authenticated client. Omit and the stored token is used, which is what
   * the CLI wants; pass one when the host already holds a session, or to mount
   * this without a credential store at all — which is how the tests run.
   */
  api?: GandiAPI
  /** Resolved once and threaded through every call. Injected by tests. */
  apiKey?: string
  /** Optional initial focus, so a host can open straight onto one domain. */
  domain?: string
}

// Two orthogonal axes. `Mode` is which tab you are on; `Phase` is what the
// screen is doing. Keeping them separate is what lets one useInput dispatch by
// phase first and mode second, with no focus manager and no nested handlers.
type Phase =
  | "loading"
  | "browsing"
  | "confirming"
  | "executing"
  | "result"
  | "actions"
  | "editing"
type Mode = "domains" | "dns" | "redirects"

type ItemAction = {
  label: string
  detail?: string
  run: () => void | Promise<void>
}

const TABS: TabItem<Mode>[] = [
  { value: "domains", label: "Domains" },
  { value: "dns", label: "DNS" },
  { value: "redirects", label: "Redirects" },
]

const HINTS: Record<Mode, [string, string][]> = {
  domains: [
    ["↑↓", "navigate"],
    ["→", "open domain"],
    ["↵", "actions"],
    ["r", "reload"],
    ["tab", "switch"],
    ["q", "quit"],
  ],
  dns: [
    ["↑↓", "navigate"],
    ["↵", "actions"],
    ["e", "edit"],
    ["d", "delete"],
    ["r", "reload"],
    ["q", "quit"],
  ],
  redirects: [
    ["↑↓", "navigate"],
    ["↵", "actions"],
    ["e", "edit target"],
    ["d", "delete"],
    ["r", "reload"],
    ["q", "quit"],
  ],
}

// Chrome is the tab strip, the breadcrumb, the footer and their margins. The
// list gives up rows to any overlay because overlays are siblings here, not
// absolutely positioned — an overlay that is not budgeted for pushes the footer
// off the bottom of the screen instead of covering the list.
const CHROME_ROWS = 8
const ASSUMED_ROWS = 24

const clock = (at: Date): string => at.toTimeString().slice(0, 8)

const nextType = (type: string): string =>
  type === "http301" ? "http302" : type === "http302" ? "cloak" : "http301"

export const GandiBody = ({
  onExit,
  api = gandiAPI,
  apiKey,
  domain: initialDomain,
}: GandiBodyProps) => {
  const [key] = useState(() => apiKey ?? getApiKey())
  const [mode, setMode] = useState<Mode>(initialDomain ? "dns" : "domains")
  const [phase, setPhase] = useState<Phase>("loading")
  const [cursor, setCursor] = useState(0)

  const [domains, setDomains] = useState<Domain[]>([])
  const [domain, setDomain] = useState<string | null>(initialDomain ?? null)
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [redirects, setRedirects] = useState<WebRedir[]>([])
  const [readAt, setReadAt] = useState<Date | null>(null)

  const [message, setMessage] = useState("")
  const [isError, setIsError] = useState(false)
  const [confirmLabel, setConfirmLabel] = useState("")
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(
    null,
  )
  const [actions, setActions] = useState<ItemAction[]>([])
  const [actionCursor, setActionCursor] = useState(0)
  const [editLabel, setEditLabel] = useState("")
  const [editInitial, setEditInitial] = useState("")
  const [onEditSubmit, setOnEditSubmit] = useState<
    ((value: string) => void) | null
  >(null)

  const showResult = (text: string, failed = false) => {
    setMessage(text)
    setIsError(failed)
    setPhase("result")
  }

  const runAction = async (action: () => void | Promise<void>) => {
    setPhase("executing")
    try {
      await action()
    } catch (error) {
      showResult(error instanceof Error ? error.message : String(error), true)
    }
  }

  const triggerConfirm = (
    label: string,
    action: () => void | Promise<void>,
  ) => {
    setConfirmLabel(label)
    // Wrapped in a thunk: useState treats a bare function as a lazy initialiser
    // and would call it immediately, running the destructive action instead of
    // storing it.
    setPending(() => action)
    setPhase("confirming")
  }

  const promptEdit = (
    label: string,
    initial: string,
    submit: (value: string) => void,
  ) => {
    setEditLabel(label)
    setEditInitial(initial)
    setOnEditSubmit(() => submit)
    setPhase("editing")
  }

  const load = async (read: () => Promise<void>) => {
    setPhase("loading")
    try {
      await read()
      // A reload that finds identical data changes nothing on screen, so
      // without a timestamp `r` looks broken even though it re-read everything.
      setReadAt(new Date())
      setPhase("browsing")
    } catch (error) {
      showResult(error instanceof Error ? error.message : String(error), true)
    }
  }

  const loadDomains = () =>
    load(async () => setDomains(await api.listDomains(key)))

  const loadDns = (target: string) =>
    load(async () => setRecords(await api.listDnsRecords(key, target)))

  const loadRedirects = (target: string) =>
    load(async () => setRedirects(await api.listRedirects(key, target)))

  // Each view owns what it loads, so switching never leaves the previous view's
  // rows on screen under a new tab's heading.
  const reload = (next: Mode = mode): Promise<void> => {
    if (next === "domains") return loadDomains()
    if (!domain) {
      showResult("Select a domain first — press → on the Domains tab.", true)
      return Promise.resolve()
    }
    return next === "dns" ? loadDns(domain) : loadRedirects(domain)
  }

  const switchTo = (next: Mode) => {
    setMode(next)
    setCursor(0)
    void reload(next)
  }

  useEffect(() => {
    void (initialDomain ? loadDns(initialDomain) : loadDomains())
  }, [])

  const rowCount = (): number =>
    mode === "domains"
      ? domains.length
      : mode === "dns"
        ? records.length
        : redirects.length

  const domainActions = (): ItemAction[] => {
    const selected = domains[cursor]
    if (!selected?.fqdn) return []
    const fqdn = selected.fqdn
    return [
      {
        label: "Open DNS records",
        detail: `Browse the LiveDNS zone for ${fqdn}`,
        run: () => {
          setDomain(fqdn)
          switchTo("dns")
        },
      },
      {
        label: "Open web redirects",
        detail: `Browse web forwarding for ${fqdn}`,
        run: () => {
          setDomain(fqdn)
          switchTo("redirects")
        },
      },
      {
        label: selected.autorenew ? "Turn autorenew off" : "Turn autorenew on",
        detail: `Currently ${selected.autorenew ? "on" : "off"}`,
        run: () =>
          triggerConfirm(
            `${selected.autorenew ? "Disable" : "Enable"} autorenew for ${fqdn}?`,
            () =>
              runAction(async () => {
                await api.setAutorenew(key, fqdn, !selected.autorenew)
                await loadDomains()
                showResult(
                  `Autorenew ${selected.autorenew ? "disabled" : "enabled"} for ${fqdn}`,
                )
              }),
          ),
      },
    ]
  }

  const dnsActions = (): ItemAction[] => {
    const record = records[cursor]
    if (!record || !domain) return []
    const target = domain
    return [
      {
        label: "Edit values",
        detail: (record.rrset_values ?? []).join(", "),
        run: () =>
          promptEdit(
            `${record.rrset_name} ${record.rrset_type} values (comma separated)`,
            (record.rrset_values ?? []).join(", "),
            (value) =>
              void runAction(async () => {
                const values = value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
                if (!values.length) {
                  showResult("No values given — nothing changed.", true)
                  return
                }
                await api.setDnsRecord(
                  key,
                  target,
                  record.rrset_type,
                  record.rrset_name,
                  values,
                  record.rrset_ttl,
                )
                await loadDns(target)
                showResult(`Updated ${record.rrset_name} ${record.rrset_type}`)
              }),
          ),
      },
      {
        label: "Edit TTL",
        detail: `${record.rrset_ttl}s`,
        run: () =>
          promptEdit(
            `${record.rrset_name} ${record.rrset_type} TTL (seconds)`,
            String(record.rrset_ttl),
            (value) =>
              void runAction(async () => {
                const ttl = Number(value)
                if (!Number.isFinite(ttl) || ttl <= 0) {
                  showResult(`"${value}" is not a valid TTL.`, true)
                  return
                }
                await api.setDnsRecord(
                  key,
                  target,
                  record.rrset_type,
                  record.rrset_name,
                  record.rrset_values ?? [],
                  ttl,
                )
                await loadDns(target)
                showResult(`TTL set to ${ttl}s`)
              }),
          ),
      },
      {
        label: "Delete record",
        detail: "Removes the whole rrset, not one value",
        run: () =>
          triggerConfirm(
            `Delete ${record.rrset_name} ${record.rrset_type} from ${target}?`,
            () =>
              runAction(async () => {
                await api.deleteDnsRecord(
                  key,
                  target,
                  record.rrset_type,
                  record.rrset_name,
                )
                await loadDns(target)
                showResult(`Deleted ${record.rrset_name} ${record.rrset_type}`)
              }),
          ),
      },
    ]
  }

  const redirectActions = (): ItemAction[] => {
    const redirect = redirects[cursor]
    if (!redirect || !domain) return []
    const target = domain
    return [
      {
        label: "Edit target",
        detail: redirect.url ?? "—",
        run: () =>
          promptEdit(
            `${redirect.host} target URL`,
            redirect.url ?? "",
            (value) =>
              void runAction(async () => {
                if (!value.trim()) {
                  showResult("No URL given — nothing changed.", true)
                  return
                }
                await api.updateRedirect(key, target, redirect.host, {
                  url: value.trim(),
                })
                await loadRedirects(target)
                showResult(`${redirect.host} → ${value.trim()}`)
              }),
          ),
      },
      {
        label: "Cycle type",
        detail: `${redirect.type} → ${nextType(redirect.type)}`,
        run: () =>
          runAction(async () => {
            const type = nextType(redirect.type)
            await api.updateRedirect(key, target, redirect.host, { type })
            await loadRedirects(target)
            showResult(`${redirect.host} is now ${type}`)
          }),
      },
      {
        label: "Delete redirect",
        detail: "The DNS record pointing at Gandi's forwarder stays",
        run: () =>
          triggerConfirm(`Delete the redirect on ${redirect.host}?`, () =>
            runAction(async () => {
              await api.deleteRedirect(key, target, redirect.host)
              await loadRedirects(target)
              showResult(`Deleted the redirect on ${redirect.host}`)
            }),
          ),
      },
    ]
  }

  // Actions are derived from the selection rather than fixed, so the modal never
  // offers something that would fail — no "edit target" on an empty redirect
  // list, no "renew" when nothing is highlighted.
  const actionsFor = (): ItemAction[] =>
    mode === "domains"
      ? domainActions()
      : mode === "dns"
        ? dnsActions()
        : redirectActions()

  const openActions = () => {
    const available = actionsFor()
    if (!available.length) {
      showResult("No actions for this selection.")
      return
    }
    setActions(available)
    setActionCursor(0)
    setPhase("actions")
  }

  const runShortcut = (prefix: string) => {
    const wanted = actionsFor().find((action) =>
      action.label.startsWith(prefix),
    )
    if (wanted) void wanted.run()
    else showResult("Nothing to do for this selection.")
  }

  useInput((input, inputKey) => {
    if (phase === "editing") {
      // Only escape: every other keystroke belongs to the TextInput, and
      // stealing them here would eat the value as it is typed.
      if (inputKey.escape) setPhase("browsing")
      return
    }
    if (phase === "result") {
      setPhase("browsing")
      return
    }
    if (phase === "confirming") {
      if (input === "y") {
        const action = pending
        setPending(null)
        void action?.()
      } else if (input === "n" || inputKey.escape) setPhase("browsing")
      return
    }
    if (phase === "actions") {
      if (inputKey.upArrow) setActionCursor((c) => Math.max(0, c - 1))
      else if (inputKey.downArrow)
        setActionCursor((c) => Math.min(actions.length - 1, c + 1))
      else if (inputKey.escape || input === "q") setPhase("browsing")
      return
    }
    if (phase !== "browsing") return

    if (input === "q") return onExit()

    if (inputKey.tab) {
      const at = TABS.findIndex((tab) => tab.value === mode)
      // Adding length before the modulo keeps shift+tab from going negative on
      // the first tab, where -1 % 3 is -1 rather than the last index.
      const step = inputKey.shift ? TABS.length - 1 : 1
      switchTo(TABS[(at + step) % TABS.length]!.value)
      return
    }
    if (inputKey.upArrow) return setCursor((c) => Math.max(0, c - 1))
    if (inputKey.downArrow)
      return setCursor((c) => Math.min(Math.max(0, rowCount() - 1), c + 1))
    if (inputKey.return) return openActions()
    if (input === "r") return void reload()

    if (mode === "domains" && inputKey.rightArrow) {
      const selected = domains[cursor]
      if (selected?.fqdn) {
        setDomain(selected.fqdn)
        switchTo("dns")
      }
      return
    }
    if (mode !== "domains" && inputKey.leftArrow) return switchTo("domains")

    // `e` and `d` are shortcuts onto entries the action modal already offers,
    // so there is exactly one implementation of each behind both routes.
    if (input === "e") return runShortcut("Edit")
    if (input === "d") return runShortcut("Delete")
  })

  const busy = phase === "loading" || phase === "executing"
  const overlayRows =
    phase === "actions"
      ? actions.length + 4
      : phase === "editing"
        ? 3
        : phase === "confirming" || phase === "result"
          ? 2
          : 0
  const listRows = Math.max(1, ASSUMED_ROWS - CHROME_ROWS - overlayRows)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Tabs active={mode} items={TABS} />
      <Box marginBottom={1}>
        <Text color={colors.muted}>
          {domain ?? "all domains"}
          {readAt ? `  ·  read at ${clock(readAt)}` : ""}
        </Text>
      </Box>

      {busy ? (
        <Spinner label={phase === "executing" ? "Working…" : "Loading…"} />
      ) : mode === "domains" ? (
        <DomainList domains={domains} selected={cursor} rows={listRows} />
      ) : mode === "dns" ? (
        <DnsList
          records={records}
          selected={cursor}
          rows={listRows}
          emptyText={domain ? "No DNS records" : "Select a domain first"}
        />
      ) : (
        <RedirectList
          redirects={redirects}
          selected={cursor}
          rows={listRows}
          emptyText={domain ? "No web redirects" : "Select a domain first"}
        />
      )}

      {phase === "actions" && (
        <Box flexDirection="column" marginTop={1}>
          <Select
            options={actions.map((action, i) => ({
              label: action.label,
              value: String(i),
            }))}
            onChange={(value) => setActionCursor(Number(value))}
            onSubmit={(value) => {
              const action = actions[Number(value)]
              setPhase("browsing")
              void action?.run()
            }}
          />
          {/* A fixed slot rather than a line under the highlighted option:
              interleaving it moved every option below as the cursor travelled,
              and made the modal's height depend on the selection. */}
          <Text color={colors.muted}>
            {actions[actionCursor]?.detail ?? " "}
          </Text>
        </Box>
      )}

      {phase === "editing" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.accent}>{editLabel}</Text>
          <TextInput
            defaultValue={editInitial}
            onSubmit={(value) => {
              const submit = onEditSubmit
              setPhase("browsing")
              submit?.(value)
            }}
          />
        </Box>
      )}

      {phase === "confirming" && (
        <Box marginTop={1}>
          <Text color={colors.warning}>{confirmLabel} </Text>
          <Text color={colors.muted}>(y/n)</Text>
        </Box>
      )}

      {phase === "result" && (
        <Box marginTop={1}>
          <StatusMessage variant={isError ? "error" : "success"}>
            {message}
          </StatusMessage>
        </Box>
      )}

      <Box marginTop={1}>
        <FooterHints hints={HINTS[mode]} />
      </Box>
    </Box>
  )
}
