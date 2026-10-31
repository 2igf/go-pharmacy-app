import { beforeAll, afterAll, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
const rows = vi.hoisted(() => ({ addresses: [] as {id:number;userId:number;address:string}[], orders: [] as {id:number;userId:number;orderNumber:string;totalAmount:string;status:string;isSimulated:boolean}[] }));
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
      orders: { list: {useQuery: () => ({data:rows.orders,error:null,isLoading:false})} },
      addresses: { list: {useQuery: () => ({data:rows.addresses,error:null,isLoading:false})}, create: mutation, delete: mutation },
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
it("allows Arabic phone input to reach the shared server validator", () => {
  auth.user = { id: 1, name: "Demo", phone: "", email: "demo@example.test", role: "user" };
  auth.loading = false;
  const html = render();
  expect(html).toContain('type="tel"');
  expect(html).not.toContain('pattern="[+0-9');
});
it("hides another account's cached addresses and orders", () => {
  auth.user = {id:1,name:"Demo",phone:"",email:"demo@example.test",role:"user"};
  rows.addresses = [{id:2,userId:2,address:"FOREIGN_PRIVATE_ADDRESS"}];
  rows.orders = [{id:2,userId:2,orderNumber:"FOREIGN_PRIVATE_ORDER",totalAmount:"1.00",status:"pending",isSimulated:true}];
  const html=render();
  expect(html).not.toContain("FOREIGN_PRIVATE_ADDRESS");
  expect(html).not.toContain("FOREIGN_PRIVATE_ORDER");
});
it("retains the authenticated account's addresses and order links", () => {
  auth.user = {id:1,name:"Demo",phone:"",email:"demo@example.test",role:"user"};
  rows.addresses = [{id:1,userId:1,address:"OWN_DEMO_ADDRESS"}];
  rows.orders = [{id:1,userId:1,orderNumber:"OWN_DEMO_ORDER",totalAmount:"1.00",status:"pending",isSimulated:true}];
  const html=render();
  expect(html).toContain("OWN_DEMO_ADDRESS");
  expect(html).toContain("OWN_DEMO_ORDER");
  expect(html).toContain('href="/order/1"');
});
