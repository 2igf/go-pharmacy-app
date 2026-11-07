const orderStatusLabels: Record<string, string> = {
  pending: "بانتظار التأكيد",
  confirmed: "تم التأكيد",
  processing: "قيد التجهيز",
  shipped: "في الطريق",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export function customerOrderStatus(status: string): string {
  return Object.hasOwn(orderStatusLabels, status)
    ? orderStatusLabels[status]
    : "الحالة غير متاحة";
}

/** Full orderNumber remains available on the linked order detail screen. */
export function shortOrderNumber(orderNumber: string): string {
  return orderNumber.length > 20 ? `…${orderNumber.slice(-8)}` : orderNumber;
}
