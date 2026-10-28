/**
 * The harness of the page tests.
 *
 * A page is the biggest piece of the frontend: it renders the data of
 * the API, the states of the request (loading, empty, error) and the
 * markup around them. Until now only the *logic* of the frontend was
 * covered (the API clients, the hooks, the shared library) - the pages
 * themselves were rendered by nobody, and a typo in a label or a
 * forgotten empty state would have reached the members.
 *
 * The harness renders a page the way the application does:
 *
 * * the real translation (Arabic), so a missing key fails the test
 *   instead of rendering the key itself;
 * * a real query client, so the states of the request are exercised;
 * * a router, so the links and the redirects work;
 * * an API that answers with the body the test decides, per URL.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { apiClient } from "@/lib/api";

/** The answers of the API: a URL (or a part of it) -> the body. */
export type ApiAnswers = Record<string, unknown>;

/** An answer that fails: the status and the body of the failure. */
export interface ApiFailure {
  status: number;
  body?: unknown;
}

function isFailure(answer: unknown): answer is ApiFailure {
  return (
    typeof answer === "object" &&
    answer !== null &&
    "status" in answer &&
    typeof (answer as ApiFailure).status === "number"
  );
}

export interface PageHarness {
  /** The calls the page made, in order. */
  calls: { method: string; url: string; params?: unknown; data?: unknown }[];
  /** The result of the render, so a test can unmount it. */
  result: RenderResult;
}

/**
 * Install an API that answers with the bodies of the test.
 *
 * The longest matching key wins, so a test can answer "/quizzes" with
 * one body and "/quizzes/1/take" with another. A URL that no key
 * matches is answered with an empty object - the test then says what
 * it needs.
 */
export function installApi(answers: ApiAnswers): PageHarness["calls"] {
  const calls: PageHarness["calls"] = [];
  const keys = Object.keys(answers).sort((a, b) => b.length - a.length);

  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? "";
    calls.push({
      method: (config.method ?? "get").toLowerCase(),
      url,
      params: config.params,
      data: config.data,
    });

    const match = keys.find((key) => url.includes(key));
    const answer = match ? answers[match] : {};

    if (isFailure(answer)) {
      const error = new Error(
        `Request failed with status code ${answer.status}`,
      );
      Object.assign(error, {
        isAxiosError: true,
        response: { status: answer.status, data: answer.body ?? {} },
        config,
      });
      throw error;
    }

    return {
      data: answer,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    } as never;
  };

  return calls;
}

/** A query client with the defaults of the application. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // The same defaults as the application (AppProviders): a query
      // that succeeded is not refetched on the next render. A test that
      // changes them measures a client that no member ever sees.
      queries: { retry: false, staleTime: 60_000 },
      mutations: { retry: false },
    },
  });
}

/**
 * Render a page.
 *
 * @param page the page (or any tree) to render.
 * @param options.route the URL of the router.
 * @param options.path the path of the route - a page that reads the
 *   parameters of the URL (the attempt of a quiz, for instance) needs
 *   it.
 * @param options.answers the answers of the API, per URL.
 * @param options.admin the page lives in the shell of the
 *   administration (the sidebar).
 */
export function renderPage(
  page: ReactElement,
  options: {
    route?: string;
    path?: string;
    answers?: ApiAnswers;
    admin?: boolean;
  } = {},
): PageHarness {
  const { route = "/", path, answers = {}, admin = false } = options;

  const calls = installApi(answers);

  const queryClient = makeQueryClient();

  const tree = path ? (
    <Routes>
      <Route path={path} element={page} />
    </Routes>
  ) : (
    page
  );

  const shell = admin ? <SidebarProvider>{tree}</SidebarProvider> : tree;

  const result = render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[route]}>{shell}</MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );

  return { calls, result };
}

/** A member the page can display (the shape of the profile). */
export const A_MEMBER = {
  id: "11111111-1111-4111-8111-111111111111",
  public_id: "M-0001",
  email: "member@example.com",
  full_name: "محمود",
  role: "MEMBER",
  status: "ACTIVE",
  phone: "+201000000000",
  avatar_url: null,
  attendance_pin_set: true,
  qr_code_token: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** Silence the console.error of React for a known warning. */
export function silenceConsoleError(): () => void {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  return () => spy.mockRestore();
}
