/**
 * HOME VISIT — can the customer actually REACH the booking step in the UI?
 *
 * The SQL suites prove the database answers correctly. They cannot prove the
 * page lets anyone get that far. The production failure was precisely a
 * frontend/backend disagreement: the picker offered dates and rendered every
 * time slot as clickable while the server refused all of them, so the
 * customer only discovered the problem after entering their address.
 *
 * These tests drive the real page through city -> service -> date -> time and
 * assert what the customer can actually click.
 *
 * SCOPE NOTE: this is jsdom, not a browser. It verifies structure, state and
 * enablement — what renders and what is clickable. It says nothing about
 * layout, spacing or how any of it looks on a real screen.
 *
 * The city control is a Radix Select, which needs pointer APIs jsdom does not
 * implement, so it is replaced with a native <select>. Every other control the
 * funnel depends on (service, date, slot) is a plain button and is driven for
 * real.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import i18n from "@/i18n";

const CITY = "city-koeln";
/**
 * Dates must be in the FUTURE relative to the run: the page disables past slots
 * via isPastSlot(), so hard-coded fixture dates silently rotted into the past and
 * made every slot appear "booked". Derived, not literal.
 */
const iso = (daysAhead: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
};
const DATES = [iso(14), iso(21)];

/** Slots the server reports as unusable. Overridden per test. */
let bookedSlots: string[] = [];

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null, session: null, roles: [], branchId: null, countryId: null,
    isAdmin: false, isSuperAdmin: false, isTherapist: false, isClient: false,
    loading: false, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
    hasRole: vi.fn().mockReturnValue(false),
  }),
}));

vi.mock("@/contexts/CountryContext", () => ({
  CountryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePublicCountry: () => ({
    countries: [],
    selectedCountry: { id: "country-de", name: "Germany", currency_code: "EUR", currency_symbol: "€", is_active: true },
    selectCountry: vi.fn(),
    loading: false,
    formatPrice: (a: number) => `€${a.toFixed(2)}`,
  }),
}));

vi.mock("@/lib/qrAccess", () => ({ hasQRAccess: () => true, grantQRAccess: vi.fn() }));
vi.mock("@/hooks/usePayment", () => ({
  usePayment: () => ({ initiatePayment: vi.fn(), isLoading: false }),
}));

vi.mock("@/hooks/useHomeAvailability", () => ({
  useHomeAvailableDates: (cityId?: string) => ({ data: cityId ? DATES : [] }),
  useHomeBookedSlots: (cityId?: string) => ({ data: cityId ? bookedSlots : [] }),
  useHomeTravelFee: (cityId?: string) => ({ data: cityId ? 12 : 0 }),
}));

/**
 * Radix Select replaced with a native one. The funnel needs a city chosen; how
 * Radix paints its popover is not what these tests are about.
 */
vi.mock("@/components/ui/select", () => {
  const Ctx = React.createContext<(v: string) => void>(() => {});
  return {
    Select: ({ value, onValueChange, children }: any) => (
      <Ctx.Provider value={onValueChange}>
        <div data-testid="city-select" data-value={value}>{children}</div>
      </Ctx.Provider>
    ),
    SelectTrigger: ({ children }: any) => <div>{children}</div>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ value, children }: any) => {
      const onChange = React.useContext(Ctx);
      return <button type="button" onClick={() => onChange(value)}>{children}</button>;
    },
  };
});

/** Chainable stub covering the exact call shapes HomeVisit uses. */
vi.mock("@/integrations/supabase/client", () => {
  const rows: Record<string, unknown[]> = {
    cities: [{ id: CITY, name: "Köln", country_id: "country-de" }],
    services: [
      { id: "svc-50", name: "Klassische Massage 50", name_ar: null, description: null, price: 55, duration_minutes: 50 },
      { id: "svc-90", name: "Klassische Massage 90", name_ar: null, description: null, price: 95, duration_minutes: 90 },
    ],
  };
  const makeQuery = (table: string) => {
    const data = rows[table] || [];
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      // HomeVisit filters services by duration; the old stub lacked this, so
      // the service list silently came back empty.
      in: () => q,
      order: () => Promise.resolve({ data, error: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res),
    };
    return q;
  };
  return {
    supabase: { from: (t: string) => makeQuery(t), rpc: () => Promise.resolve({ data: [], error: null }) },
  };
});

const renderPage = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const HomeVisit = (await import("@/pages/HomeVisit")).default;
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <MemoryRouter initialEntries={["/home-visit"]}>
            <Routes>
              <Route path="/home-visit" element={<HomeVisit />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );
};

/** city -> service -> date, the shared prefix of every case below. */
async function walkToSlots() {
  fireEvent.click(await screen.findByRole("button", { name: /Köln/i }));
  const service = await screen.findByRole("button", { name: /Klassische Massage 50/i });
  fireEvent.click(service);
  const date = await screen.findByRole("button", { name: DATES[0] });
  fireEvent.click(date);
}

describe("Home Visit — the customer can reach the booking step", () => {
  afterEach(cleanup);

  it("walks city, service, date and time to the payment step", async () => {
    bookedSlots = [];
    await i18n.changeLanguage("de");
    await renderPage();

    // The service list must actually populate — an empty list is its own
    // dead end, and the page swallows query errors.
    fireEvent.click(await screen.findByRole("button", { name: /Köln/i }));
    expect(await screen.findByRole("button", { name: /Klassische Massage 50/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Klassische Massage 90/i })).toBeInTheDocument();
    expect(screen.queryByText(/keine Behandlungen als Hausbesuch/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Klassische Massage 50/i }));
    expect(await screen.findByRole("button", { name: DATES[0] })).toBeInTheDocument();
    expect(screen.queryByText(/keine Termine verfügbar/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: DATES[0] }));

    // At least one slot must be clickable. This is the exact production
    // failure: slots rendered, every one refused by the server.
    const slot = await screen.findByRole("button", { name: "11:00" });
    expect(slot).toBeEnabled();
    fireEvent.click(slot);

    // The booking step is reached: summary plus the payment call to action.
    expect(await screen.findByRole("button", { name: /Weiter zur Zahlung/i })).toBeInTheDocument();
  });

  it("shows the travel fee and a total that includes it", async () => {
    bookedSlots = [];
    await i18n.changeLanguage("de");
    await renderPage();
    await walkToSlots();
    fireEvent.click(await screen.findByRole("button", { name: "11:00" }));

    // 55 base + 12 travel fee. The old page showed 55 and charged 67.
    expect(await screen.findByText(/Anfahrtspauschale/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("+€12.00")).toBeInTheDocument();
      expect(screen.getByText("€67.00")).toBeInTheDocument();
    });
  });

  it("disables slots the server cannot serve instead of letting them be picked", async () => {
    // What the fixed get_home_booked_slots returns for a pool with no usable
    // working window: everything blocked.
    bookedSlots = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];
    await i18n.changeLanguage("de");
    await renderPage();
    await walkToSlots();

    for (const t of ["09:00", "11:00", "19:00"]) {
      expect(await screen.findByRole("button", { name: t })).toBeDisabled();
    }
    // No slot chosen means no summary and no way to pay — the customer is
    // stopped here rather than after entering their address.
    expect(screen.queryByRole("button", { name: /Weiter zur Zahlung/i })).not.toBeInTheDocument();
  });

  it("says so plainly when the city has no dates at all", async () => {
    bookedSlots = [];
    await i18n.changeLanguage("de");
    await renderPage();
    // Before a city is chosen the page must not pretend anything is bookable.
    expect(screen.queryByRole("button", { name: DATES[0] })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Köln/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Klassische Massage 50/i }));
    expect(await screen.findByRole("button", { name: DATES[0] })).toBeInTheDocument();
  });
});
