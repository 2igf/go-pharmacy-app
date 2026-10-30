import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  nextBannerIndex,
  promotionalBanners,
  safeBannerHref,
  scheduleBannerAdvance,
  swipeBannerDirection,
  type PromotionalBanner,
} from "./banner-policy";
import "./carousel.css";

export default function PromotionalCarousel({
  banners = promotionalBanners,
  rtl = true,
}: {
  banners?: readonly PromotionalBanner[];
  rtl?: boolean;
}) {
  const [position, setPosition] = useState({ index: 0, interaction: 0 });
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const index = nextBannerIndex(position.index, 0, banners.length);
  const active = banners[index];
  const multi = banners.length > 1;
  const stopped = paused || hover || focused || hidden || dragging;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    const visibility = () => setHidden(document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(
    () =>
      scheduleBannerAdvance(
        () => {
          setPosition(previous => ({
            ...previous,
            index: nextBannerIndex(previous.index, 1, banners.length),
          }));
        },
        { count: banners.length, paused: stopped, reducedMotion }
      ),
    [banners.length, position, stopped, reducedMotion]
  );

  function goTo(target: number) {
    setPosition(previous => ({
      index: nextBannerIndex(target, 0, banners.length),
      interaction: previous.interaction + 1,
    }));
  }
  if (!active) return null;
  const href = safeBannerHref(active.href);
  const image = (
    <img
      src={active.src}
      alt={active.alt}
      width={622}
      height={258}
      draggable={false}
    />
  );
  return (
    <section
      className="canva-carousel"
      dir={rtl ? "rtl" : "ltr"}
      aria-label="بنرات التصميم الأصلي"
      aria-roledescription="عارض شرائح"
      onPointerEnter={event => {
        if (event.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={event => {
        if (event.pointerType === "mouse") setHover(false);
      }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={event => {
        if (!multi || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        goTo(
          index + (event.key === "ArrowLeft" ? (rtl ? 1 : -1) : rtl ? -1 : 1)
        );
      }}
    >
      <div
        className="canva-carousel__viewport"
        onPointerDown={event => {
          if (!multi || !event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
          };
          setDragging(true);
        }}
        onPointerMove={event => {
          const start = pointer.current;
          if (
            start &&
            start.id === event.pointerId &&
            swipeBannerDirection(
              event.clientX - start.x,
              event.clientY - start.y,
              rtl
            )
          )
            event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={event => {
          const start = pointer.current;
          pointer.current = null;
          setDragging(false);
          if (!start || start.id !== event.pointerId) return;
          const direction = swipeBannerDirection(
            event.clientX - start.x,
            event.clientY - start.y,
            rtl
          );
          if (direction) {
            suppressClick.current = true;
            goTo(index + direction);
          }
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setDragging(false);
        }}
        onPointerLeave={event => {
          if (
            pointer.current &&
            !event.currentTarget.hasPointerCapture(pointer.current.id)
          ) {
            pointer.current = null;
            setDragging(false);
          }
        }}
        onClickCapture={event => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        <div
          key={active.id}
          className={`canva-carousel__slide ${multi ? "canva-carousel__slide--animated" : ""}`}
          role="group"
          aria-roledescription="شريحة"
          aria-label={`${index + 1} من ${banners.length}`}
        >
          {href ? (
            <Link href={href} aria-label={`${active.alt} — تصفح الكتالوج`}>
              {image}
            </Link>
          ) : (
            image
          )}
        </div>
      </div>
      {multi && (
        <div className="canva-carousel__controls">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="البنر السابق"
          >
            {rtl ? "›" : "‹"}
          </button>
          <div className="canva-carousel__indicators" aria-label="اختيار البنر">
            {banners.map((banner, slide) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`عرض البنر ${slide + 1}`}
                aria-current={slide === index ? "true" : undefined}
                onClick={() => goTo(slide)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="البنر التالي"
          >
            {rtl ? "‹" : "›"}
          </button>
          {!reducedMotion && (
            <button
              type="button"
              className="canva-carousel__pause"
              onClick={() => setPaused(value => !value)}
              aria-label={
                paused
                  ? "تشغيل تبديل البنرات تلقائياً"
                  : "إيقاف تبديل البنرات تلقائياً"
              }
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          )}
        </div>
      )}
      <p className="canva-carousel__caption">
        من التصميم الأصلي — لا يمثل عرضًا أو توفرًا للبيع
      </p>
      {multi && (
        <span
          className="sr-only"
          aria-live={stopped || reducedMotion ? "polite" : "off"}
        >
          البنر {index + 1} من {banners.length}
        </span>
      )}
    </section>
  );
}
