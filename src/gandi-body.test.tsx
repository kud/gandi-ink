import { describe, it, expect, vi } from "vitest"
import { render } from "ink-testing-library"
import type { DnsRecord, Domain, GandiAPI, WebRedir } from "@kud/gandi"
import { GandiBody } from "./gandi-body.js"

// Fixtures carry only the fields the components read. The casts are deliberate:
// spelling out every field of a Gandi API response would bury what each test is
// actually about, and the component's own types still police how they are used.
const DOMAINS = [
  {
    fqdn: "kud.io",
    autorenew: true,
    dates: { registry_ends_at: "2027-01-01T00:00:00Z" },
  },
  { fqdn: "example.net", autorenew: false, dates: {} },
] as unknown as Domain[]

const RECORDS = [
  {
    rrset_name: "www",
    rrset_type: "CNAME",
    rrset_ttl: 10800,
    rrset_values: ["webredir.gandi.net."],
    rrset_href: "https://api.gandi.net/v5/livedns/domains/kud.io/records/www",
  },
] as unknown as DnsRecord[]

const REDIRECTS = [
  { host: "trakt.kud.io", type: "http301", url: "https://trakt.tv/users/kud" },
] as unknown as WebRedir[]

// A façade rather than the real client — which is exactly why GandiBody takes
// `api` and `apiKey` as props. Without that seam the component would reach for
// a stored credential at mount and no test could run at all.
const api = (overrides: Partial<GandiAPI> = {}) =>
  ({
    listDomains: vi.fn(async () => DOMAINS),
    listDnsRecords: vi.fn(async () => RECORDS),
    listRedirects: vi.fn(async () => REDIRECTS),
    setAutorenew: vi.fn(async () => undefined),
    setDnsRecord: vi.fn(async () => undefined),
    deleteDnsRecord: vi.fn(async () => undefined),
    updateRedirect: vi.fn(async () => undefined),
    deleteRedirect: vi.fn(async () => undefined),
    ...overrides,
  }) as unknown as GandiAPI

// Ink renders asynchronously and the body loads on mount, so assertions need a
// tick before the first frame means anything.
const settled = () => new Promise((resolve) => setTimeout(resolve, 60))

const mount = (props: Partial<Parameters<typeof GandiBody>[0]> = {}) =>
  render(
    <GandiBody onExit={() => {}} api={api()} apiKey="test-key" {...props} />,
  )

describe("mounting", () => {
  it("lists domains once loading settles", async () => {
    const { lastFrame } = mount()
    await settled()
    expect(lastFrame()).toContain("kud.io")
    expect(lastFrame()).toContain("example.net")
  })

  // DNS records and web redirects belong to a domain, so they are not offered
  // until one is chosen. Showing them as peers of the domain list invited
  // "select a domain first" errors on tabs the user could already see.
  it("offers no per-domain tabs until a domain is chosen", async () => {
    const { lastFrame } = mount()
    await settled()
    const frame = lastFrame() ?? ""
    expect(frame).toContain("Domains")
    expect(frame).not.toContain("Redirects")
  })

  it("shows the per-domain tabs once inside a domain", async () => {
    const { lastFrame } = mount({ domain: "kud.io" })
    await settled()
    const frame = lastFrame() ?? ""
    expect(frame).toContain("DNS")
    expect(frame).toContain("Redirects")
    expect(frame).toContain("Info")
  })

  it("uses the client it is handed rather than a stored credential", async () => {
    const listDomains = vi.fn(async () => DOMAINS)
    mount({ api: api({ listDomains } as Partial<GandiAPI>) })
    await settled()
    expect(listDomains).toHaveBeenCalledWith("test-key")
  })

  it("opens straight onto a domain's DNS when given one", async () => {
    const listDnsRecords = vi.fn(async () => RECORDS)
    mount({
      domain: "kud.io",
      api: api({ listDnsRecords } as Partial<GandiAPI>),
    })
    await settled()
    expect(listDnsRecords).toHaveBeenCalledWith("test-key", "kud.io")
  })
})

describe("navigating", () => {
  it("cycles tabs with tab", async () => {
    const { lastFrame, stdin } = mount({ domain: "kud.io" })
    await settled()
    stdin.write("\t")
    await settled()
    // DNS → Redirects: the redirect host renders fully qualified, exactly once.
    expect(lastFrame()).toContain("trakt.kud.io")
    expect(lastFrame()).not.toContain("trakt.kud.io.kud.io")
  })

  it("drills into a domain with → and loads its records", async () => {
    const listDnsRecords = vi.fn(async () => RECORDS)
    const { lastFrame, stdin } = mount({
      api: api({ listDnsRecords } as Partial<GandiAPI>),
    })
    await settled()
    stdin.write("\u001B[C") // right arrow
    await settled()
    expect(listDnsRecords).toHaveBeenCalledWith("test-key", "kud.io")
    expect(lastFrame()).toContain("DNS")
  })

  it("comes back out to the domain list with ←", async () => {
    const { lastFrame, stdin } = mount({ domain: "kud.io" })
    await settled()
    stdin.write("\u001B[D") // left arrow
    await settled()
    const frame = lastFrame() ?? ""
    expect(frame).toContain("example.net")
    expect(frame).not.toContain("Redirects")
  })

  it("quits through onExit rather than owning the terminal", async () => {
    let exited = false
    const { stdin } = mount({ onExit: () => (exited = true) })
    await settled()
    stdin.write("q")
    expect(exited).toBe(true)
  })
})

describe("failure", () => {
  it("leaves the error on screen rather than an empty list", async () => {
    const { lastFrame } = mount({
      api: api({
        listDomains: vi.fn(async () => {
          throw new Error("token expired")
        }),
      } as Partial<GandiAPI>),
    })
    await settled()
    expect(lastFrame()).toContain("token expired")
  })
})

describe("mutations", () => {
  it("never fires a destructive call without a confirmation", async () => {
    const deleteRedirect = vi.fn(async () => undefined)
    const { lastFrame, stdin } = mount({
      domain: "kud.io",
      api: api({ deleteRedirect } as Partial<GandiAPI>),
    })
    await settled()
    stdin.write("\t") // → Redirects
    await settled()
    stdin.write("d")
    await settled()

    expect(lastFrame()).toContain("Delete the redirect on trakt.kud.io?")
    expect(deleteRedirect).not.toHaveBeenCalled()
  })

  it("declining a confirmation leaves the redirect alone", async () => {
    const deleteRedirect = vi.fn(async () => undefined)
    const { stdin } = mount({
      domain: "kud.io",
      api: api({ deleteRedirect } as Partial<GandiAPI>),
    })
    await settled()
    stdin.write("\t")
    await settled()
    stdin.write("d")
    await settled()
    stdin.write("n")
    await settled()

    expect(deleteRedirect).not.toHaveBeenCalled()
  })

  it("confirming deletes, and re-reads rather than trusting local state", async () => {
    const deleteRedirect = vi.fn(async () => undefined)
    const listRedirects = vi.fn(async () => REDIRECTS)
    const { stdin } = mount({
      domain: "kud.io",
      api: api({ deleteRedirect, listRedirects } as Partial<GandiAPI>),
    })
    await settled()
    stdin.write("\t")
    await settled()
    const readsBefore = listRedirects.mock.calls.length
    stdin.write("d")
    await settled()
    stdin.write("y")
    await settled()

    expect(deleteRedirect).toHaveBeenCalledWith(
      "test-key",
      "kud.io",
      "trakt.kud.io",
    )
    expect(listRedirects.mock.calls.length).toBeGreaterThan(readsBefore)
  })
})
