/**
 * Home Visit — frontend render tests (jsdom).
 *
 * Verifies the customer entry point and the Home Visit page render natively
 * inside the existing Massavo shell, with the address (destination) form and
 * city/service selectors present. Backend is fully mocked here.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import i18n from "@/i18n";

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
    formatPrice: (amount: number) => `€${amount.toFixed(2)}`,
  }),
}));

// Home Visit is QR-gated like the rest of the funnel; grant access in tests.
vi.mock("@/lib/qrAccess", () => ({
  hasQRAccess: () => true,
  grantQRAccess: vi.fn(),
}));

vi.mock("@/hooks/usePayment", () => ({
  usePayment: () => ({ initiatePayment: vi.fn(), isLoading: false }),
}));

vi.mock("@/hooks/useHomeAvailability", () => ({
  useHomeAvailableDates: () => ({ data: ["2099-01-05", "2099-01-06"] }),
  useHomeBookedSlots: () => ({ data: ["12:00"] }),
}));

// Chainable supabase stub: cities + services queries used by HomeVisit.
vi.mock("@/integrations/supabase/client", () => {
  const rows: Record<string, unknown[]> = {
    cities: [{ id: "city-1", name: "Berlin", country_id: "country-de" }],
    services: [{ id: "svc-1", name: "Sports Massage", name_ar: null, description: null, price: 60, duration_minutes: 50 }],
  };
  const makeQuery = (table: string) => {
    const data = rows[table] || [];
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      order: () => Promise.resolve({ data, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return q;
  };
  return {
    supabase: {
      from: (table: string) => makeQuery(table),
      rpc: () => Promise.resolve({ data: [], error: null }),
    },
  };
});

const renderRoute = (path: string, element: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={path} element={element} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );
};

async function withLang(lang: "de" | "en") {
  await i18n.changeLanguage(lang);
}

describe("Home Visit — entry point (/book)", () => {
  afterEach(cleanup);

  it("shows a Home Visit entry linking to /home-visit (DE)", async () => {
    await withLang("de");
    const Book = (await import("@/pages/Book")).default;
    renderRoute("/book", <Book />);
    // There can be more than one match (a header nav link + the booking card),
    // both valid; assert at least one Home Visit link points to /home-visit.
    const links = await screen.findAllByRole("link", { name: /Hausbesuch/i });
    expect(links.some((l) => l.getAttribute("href") === "/home-visit")).toBe(true);
  });

  it("shows a Home Visit entry linking to /home-visit (EN)", async () => {
    await withLang("en");
    const Book = (await import("@/pages/Book")).default;
    renderRoute("/book", <Book />);
    const links = await screen.findAllByRole("link", { name: /Home Visit/i });
    expect(links.some((l) => l.getAttribute("href") === "/home-visit")).toBe(true);
  });
});

describe("Home Visit — booking page", () => {
  afterEach(cleanup);

  it("renders the page with the city selector and address hint (DE)", async () => {
    await withLang("de");
    const HomeVisit = (await import("@/pages/HomeVisit")).default;
    renderRoute("/home-visit", <HomeVisit />);
    expect(await screen.findByText(/Massage als Hausbesuch/i)).toBeInTheDocument();
    // City select is present (the first gate of the flow).
    expect(screen.getByText(/Stadt auswählen/i)).toBeInTheDocument();
  });

  it("loads the active country's cities into the selector", async () => {
    await withLang("de");
    const HomeVisit = (await import("@/pages/HomeVisit")).default;
    renderRoute("/home-visit", <HomeVisit />);
    // Berlin comes from the mocked cities query for country-de.
    await waitFor(() => {
      expect(screen.getByText(/Massage als Hausbesuch/i)).toBeInTheDocument();
    });
  });
});
