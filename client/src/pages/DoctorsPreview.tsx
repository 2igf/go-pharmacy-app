import { useState } from "react";
import {
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Wallet,
} from "lucide-react";
import { UnavailableControl } from "@/customer/CustomerPieces";
import "@/customer/doctors.css";

const specialties = ["جلدية", "أسنان", "عظام", "أطفال", "باطنية"];
const previewPhotos = [1, 2, 3];
const unavailableMessage =
  "هذه معاينة لتصميم Canva فقط. لا تتوفر بيانات أطباء أو مواعيد أو رسوم أو تقييمات موثقة، ولا توجد استشارة أو حجوزات متاحة.";

export default function DoctorsPreview() {
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState(false);
  return (
    <main className="canva-doctors" dir="rtl">
      <h1 className="sr-only">الأطباء والعيادات — معاينة التصميم</h1>
      <header className="canva-doctors__header">
        <form
          className="canva-doctors__search"
          role="search"
          onSubmit={event => {
            event.preventDefault();
            setSearched(true);
          }}
        >
          <button type="submit" aria-label="بحث في معاينة الأطباء">
            <Search aria-hidden="true" />
          </button>
          <input
            type="search"
            aria-label="البحث في معاينة التصميم فقط"
            placeholder="ابحث عن اسم عيادة أو طبيب"
            maxLength={100}
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setSearched(false);
            }}
          />
          <UnavailableControl
            className="canva-doctors__filter"
            label="تصفية الأطباء"
            message={unavailableMessage}
          >
            <SlidersHorizontal aria-hidden="true" />
          </UnavailableControl>
        </form>
        <div
          className="canva-doctors__specialties"
          aria-label="التخصصات — معاينة فقط"
        >
          {specialties.map(label => (
            <UnavailableControl
              key={label}
              label={label}
              message={unavailableMessage}
            />
          ))}
        </div>
      </header>
      <p className="canva-doctors__notice" role="status">
        معاينة التصميم فقط — الأطباء والعيادات والحجوزات غير متاحة حاليًا.
      </p>
      {searched && (
        <p className="canva-doctors__search-status" role="status">
          لا توجد خدمة بحث بأطباء فعليين حاليًا. البطاقات التالية أمثلة بصرية من
          التصميم.
        </p>
      )}
      <section
        className="canva-doctors__list"
        aria-label="بطاقات الأطباء المرجعية"
      >
        {previewPhotos.map((photo, index) => (
          <article className="canva-doctors__card" key={photo}>
            <img
              className="canva-doctors__photo"
              src={`/canva-v2/doctor-preview-${photo}.png`}
              alt={`صورة مرجعية من Canva لبطاقة طبيب ${index + 1}؛ ليست هوية طبيب متاح`}
              width={160}
              height={190}
            />
            <div className="canva-doctors__details">
              <h2>معاينة بطاقة طبيب {index + 1}</h2>
              <p>
                <Clock3 aria-hidden="true" />
                <span>مدة الانتظار: غير متاحة</span>
              </p>
              <p>
                <Wallet aria-hidden="true" />
                <span>رسوم الكشف: غير متاحة</span>
              </p>
              <div className="canva-doctors__metadata">
                <span>
                  <Star aria-hidden="true" />
                  لا تقييم موثق
                </span>
                <span>
                  <MapPin aria-hidden="true" />
                  الموقع غير متاح
                </span>
              </div>
            </div>
            <div className="canva-doctors__actions">
              <UnavailableControl
                label="احجز موعد"
                message={unavailableMessage}
              />
              <UnavailableControl
                label="استشارة طبيب"
                message={unavailableMessage}
              />
            </div>
          </article>
        ))}
      </section>
      <section
        className="canva-doctors__clinics"
        aria-label="شعارات العيادات من التصميم المرجعي"
      >
        <h2>عيادات</h2>
        <div>
          <UnavailableControl
            label="معاينة عيادة Grande"
            message={unavailableMessage}
          >
            <img
              src="/canva-v2/clinic-grande.png"
              width={284}
              height={284}
              alt="شعار Grande من مرجع التصميم — لا يمثل عيادة متاحة"
            />
          </UnavailableControl>
          <UnavailableControl
            label="معاينة عيادة DermaClinic"
            message={unavailableMessage}
          >
            <img
              src="/canva-v2/clinic-derma.png"
              width={284}
              height={284}
              alt="شعار DermaClinic من مرجع التصميم — لا يمثل عيادة متاحة"
            />
          </UnavailableControl>
        </div>
      </section>
    </main>
  );
}
