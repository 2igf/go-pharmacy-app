import { TRPCError } from "@trpc/server";
export function moneyToCents(value: string): number {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid price" });
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function centsToMoney(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 9999999999)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Amount out of range",
    });
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
export function quoteLines(lines: { price: string; quantity: number }[]) {
  let cents = 0;
  for (const line of lines) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Quantity must be 1–99",
      });
    cents += moneyToCents(line.price) * line.quantity;
  }
  const total = centsToMoney(cents);
  return { subtotal: total, shipping: "0.00", tax: "0.00", total };
}
export const statuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof statuses)[number];
export function assertTransition(from: OrderStatus, to: OrderStatus) {
  const next: Record<OrderStatus, OrderStatus[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };
  if (from !== to && !next[from].includes(to))
    throw new TRPCError({
      code: "CONFLICT",
      message: "Invalid order status transition",
    });
}
