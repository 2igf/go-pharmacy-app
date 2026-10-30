import { beforeAll, afterAll, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
const auth = vi.hoisted(() => ({
  user: null as null | {
    id: number;
    name: string;
    phone: string;
    email: string;
    role: string;
  },
  loading: false,
  logout: () => Promise.resolve(),
}));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../client/src/lib/trpc", () => {
  const query = {
    useQuery: () => ({ data: [], error: null, isLoading: false }),
  };
  const mutation = {
    useMutation: () => ({ mutate: () => {}, isPending: false, error: null }),
  };
  return {
    trpc: {
      useUtils: () => ({}),
      orders: { list: query },
      addresses: { list: query, create: mutation, delete: mutation },
      auth: { updateProfile: mutation },
    },
  };
});
import Profile from "../client/src/pages/Profile";
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const render = () =>
  renderToStaticMarkup(
    React.createElement(Router, {
      ssrPath: "/profile",
      children: React.createElement(Profile),
    })
  );
it("does not render private editable account forms after confirmed logout", () => {
  auth.user = null;
  auth.loading = false;
  expect(render()).not.toContain("الاسم الخيالي");
  expect(render()).not.toContain("عنوان خيالي جديد");
});
it("does not show an editable profile while authentication is unresolved", () => {
  auth.user = null;
  auth.loading = true;
  expect(render()).not.toContain("الاسم الخيالي");
  expect(render()).toContain("جار التحقق");
});
