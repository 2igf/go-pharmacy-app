import { afterEach, describe, expect, it, vi } from "vitest";
import {
  nextBannerIndex,
  promotionalBanners,
  safeBannerHref,
  scheduleBannerAdvance,
  swipeBannerDirection,
} from "../client/src/customer/banner-policy";

afterEach(() => vi.useRealTimers());
describe("promotional carousel policy", () => {
  it("uses the sole approved original artwork without duplicate offers", () => {
    expect(promotionalBanners).toHaveLength(1);
    expect(promotionalBanners[0].src).toBe("/canva/banner-dozova.png");
  });
  it("cycles forwards/backwards and wraps synthetic multiple-slide fixtures", () => {
    expect(nextBannerIndex(0, 1, 3)).toBe(1);
    expect(nextBannerIndex(2, 1, 3)).toBe(0);
    expect(nextBannerIndex(0, -1, 3)).toBe(2);
    expect(nextBannerIndex(0, 1, 1)).toBe(0);
    expect(nextBannerIndex(0, 1, 0)).toBe(0);
  });
  it("accepts horizontal finger swipes in both text directions, preserving vertical scrolling", () => {
    expect(swipeBannerDirection(70, 10, true)).toBe(1);
    expect(swipeBannerDirection(-70, 10, true)).toBe(-1);
    expect(swipeBannerDirection(-70, 10, false)).toBe(1);
    expect(swipeBannerDirection(25, 0, true)).toBe(0);
    expect(swipeBannerDirection(70, 90, true)).toBe(0);
  });
  it("permits only bounded internal catalog/preview destinations", () => {
    expect(safeBannerHref("/products?view=all")).toBe("/products?view=all");
    expect(safeBannerHref("/product/42")).toBe("/product/42");
    expect(safeBannerHref("/doctors")).toBe("/doctors");
    for (const value of [
      "https://untrusted.test",
      "//untrusted.test",
      "javascript:alert(1)",
      "/admin",
      "/products\\evil",
      "/products\n",
      "/products?redirect=https://untrusted.test",
    ])
      expect(safeBannerHref(value)).toBeUndefined();
  });
  it("advances after five seconds and cancels/restarts after manual interaction", () => {
    vi.useFakeTimers();
    const advance = vi.fn();
    const cancel = scheduleBannerAdvance(advance, {
      count: 3,
      paused: false,
      reducedMotion: false,
    });
    vi.advanceTimersByTime(4999);
    expect(advance).not.toHaveBeenCalled();
    cancel();
    scheduleBannerAdvance(advance, {
      count: 3,
      paused: false,
      reducedMotion: false,
    });
    vi.advanceTimersByTime(4999);
    expect(advance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(advance).toHaveBeenCalledTimes(1);
  });
  it("does not animate one slide, a paused carousel, or reduced-motion preference", () => {
    vi.useFakeTimers();
    const advance = vi.fn();
    scheduleBannerAdvance(advance, {
      count: 1,
      paused: false,
      reducedMotion: false,
    });
    scheduleBannerAdvance(advance, {
      count: 3,
      paused: true,
      reducedMotion: false,
    });
    scheduleBannerAdvance(advance, {
      count: 3,
      paused: false,
      reducedMotion: true,
    });
    vi.advanceTimersByTime(10000);
    expect(advance).not.toHaveBeenCalled();
  });
});
