import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import PromotionalCarousel from "../client/src/customer/PromotionalCarousel";
import DoctorsPreview from "../client/src/pages/DoctorsPreview";

// The server test configuration uses classic JSX; the app build uses the React plugin.
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("customer Canva V2 rendering", () => {
  it("renders multiple slide controls using synthetic fixtures only", () => {
    const html = renderToStaticMarkup(
      createElement(Router, {
        ssrPath: "/",
        children: createElement(PromotionalCarousel, {
          banners: [
            {
              id: "test-1",
              src: "/test-fixtures/one.png",
              alt: "TEST FIXTURE ONE",
              href: "/products?view=all",
            },
            {
              id: "test-2",
              src: "/test-fixtures/two.png",
              alt: "TEST FIXTURE TWO",
              href: "https://untrusted.test",
            },
            {
              id: "test-3",
              src: "/test-fixtures/three.png",
              alt: "TEST FIXTURE THREE",
            },
          ],
        }),
      })
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('aria-label="عرض البنر 3"');
    expect(html).toContain('aria-label="البنر التالي"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('href="/products?view=all"');
    expect(html).not.toContain('href="https://untrusted.test"');
  });
  it("shows one supplied artwork without pretending to rotate multiple offers", () => {
    const html = renderToStaticMarkup(
      createElement(Router, {
        ssrPath: "/",
        children: createElement(PromotionalCarousel),
      })
    );
    expect(html).toContain("/canva/banner-dozova.png");
    expect(html).not.toContain('aria-label="البنر التالي"');
    expect(html).not.toContain('aria-label="عرض البنر 2"');
  });
  it("renders reference portraits and clinic logos with unavailable medical controls and no screenshot facts", () => {
    const html = renderToStaticMarkup(createElement(DoctorsPreview));
    expect(html).toContain("/canva-v2/doctor-preview-3.png");
    expect(html).toContain("/canva-v2/clinic-grande.png");
    expect(html).toContain("معاينة التصميم فقط");
    expect(html).toContain("رسوم الكشف: غير متاحة");
    expect(html).toContain("لا تقييم موثق");
    expect(html).toContain("احجز موعد — غير متاح حاليًا");
    expect(html).not.toContain("عصام");
    expect(html).not.toContain("20JD");
    expect(html).not.toContain("40 دقيقة");
  });
});
