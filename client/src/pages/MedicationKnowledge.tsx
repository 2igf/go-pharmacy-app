import type { knowledgeDetail } from "../../../server/medication-knowledge/repository";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { NLM_ATTRIBUTION } from "@shared/medication-knowledge";
import "@/customer/knowledge.css";
export type KnowledgeDetail = Awaited<ReturnType<typeof knowledgeDetail>>;
const unknown = "غير معروف";
function SourceReference({ value }: { value: string | null | undefined }) {
  if (!value) return <span>{unknown}</span>;
  let safe = false;
  try {
    const url = new URL(value);
    if (url.username || url.password)
      return <span>مرجع مصدري غير صالح للعرض</span>;
    safe = url.protocol === "https:" && !url.username && !url.password;
  } catch {
    /* Plain source references are displayed as text. */
  }
  return safe ? (
    <a href={value} target="_blank" rel="noopener noreferrer" dir="auto">
      {value}
    </a>
  ) : (
    <span dir="auto">{value}</span>
  );
}
function timestamp(value: Date | string | null | undefined) {
  if (!value) return unknown;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? `${date.toLocaleString("ar-JO", { timeZone: "UTC" })} UTC`
    : unknown;
}
function NlmAttribution() {
  return (
    <footer className="medication-knowledge__attribution">
      <p lang="en" dir="ltr">
        {NLM_ATTRIBUTION}
      </p>
      <a
        href="https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        المصدر وشروط استخدام بيانات NLM / RxNorm
      </a>
    </footer>
  );
}
export function KnowledgeScopeNotice({
  country,
}: {
  country: "JO" | "international";
}) {
  return (
    <p className="medication-knowledge__scope" role="status">
      {country === "JO"
        ? "الأردن: يعرض هذا النطاق سجلات لديها تسجيل أردني موثق من مصدر مختص. قد تكون القائمة فارغة حتى تكتمل البيانات الموثقة."
        : "النطاق الدولي: مصطلحات وأسماء من مصادر دولية محدودة، ومنها RxNorm. ظهور السجل لا يعني اعتماداً أو تسجيلاً في الأردن، ولا يثبت السعر أو التوفر للبيع."}
    </p>
  );
}
export function KnowledgeDetailContent({
  data,
  language,
}: {
  data: KnowledgeDetail;
  language: "ar" | "en";
}) {
  const names = data.names;
  const title =
    names.find(name => name.language === language)?.name ?? data.name;
  const verified = data.registrations.filter(
    row =>
      row.reviewState === "verified" && row.verifiedAt && row.registrationNumber
  );
  const jordan = verified.filter(row => row.country === "JO");
  const sourcedPrice = jordan.find(
    row =>
      row.priceState === "sourced" &&
      row.priceJod !== null &&
      row.priceAsOf &&
      row.priceSourceReference
  );
  const reviewed = data.labels.filter(
    label =>
      label.language === language &&
      label.reviewedAt &&
      label.section !== "dosage"
  );
  const sectionNames = {
    description: "وصف المصدر",
    interactions: "تداخلات المصدر",
    indications: "نص الاستعمالات من المصدر",
    warnings: "تحذيرات المصدر",
    side_effects: "الآثار الجانبية في المصدر",
    contraindications: "موانع الاستعمال في المصدر",
  };
  return (
    <>
      <article className="medication-knowledge__card">
        <h2 dir="auto">{title}</h2>
        <KnowledgeScopeNotice
          country={jordan.length ? "JO" : "international"}
        />
        <p>
          مرجع معلومات فقط. استشر الطبيب أو الصيدلي بخصوص دوائك. لا يقدّم هذا
          الدليل تشخيصاً أو وصفة أو توصية بجرعة.
        </p>
        {language === "ar" && !names.some(name => name.language === "ar") && (
          <p>
            لا تتوفر ترجمة عربية موثقة؛ تظهر الأسماء الإنجليزية كما وردت في
            المصدر.
          </p>
        )}
        <dl className="medication-knowledge__facts">
          <dt>الأسماء العلمية / Generic</dt>
          <dd>
            {names.filter(name => name.kind === "generic").length
              ? names
                  .filter(name => name.kind === "generic")
                  .map((name, index) => (
                    <p key={index} lang={name.language} dir="auto">
                      {name.name}{" "}
                      <small>
                        ({name.language === "ar" ? "العربية" : "English"})
                      </small>
                    </p>
                  ))
              : unknown}
          </dd>
          <dt>الأسماء التجارية / Brand</dt>
          <dd>
            {names.filter(name => name.kind === "brand").length
              ? names
                  .filter(name => name.kind === "brand")
                  .map((name, index) => (
                    <p key={index} lang={name.language} dir="auto">
                      {name.name}{" "}
                      <small>
                        ({name.language === "ar" ? "العربية" : "English"})
                      </small>
                    </p>
                  ))
              : unknown}
          </dd>
          <dt>الشكل الصيدلاني</dt>
          <dd dir="auto">{data.facts.dosageForm ?? unknown}</dd>
          <dt>طريق الاستعمال</dt>
          <dd dir="auto">{data.facts.route ?? unknown}</dd>
          <dt>الشركة المصنّعة</dt>
          <dd dir="auto">{data.facts.manufacturer ?? unknown}</dd>
          <dt>معرّف العبوة</dt>
          <dd dir="auto">{data.facts.packageIdentifier ?? unknown}</dd>
          <dt>حالة الوصفة بالمصدر</dt>
          <dd>
            {data.facts.prescriptionStatus === "prescription"
              ? "بوصفة حسب المصدر"
              : data.facts.prescriptionStatus === "otc"
                ? "دون وصفة حسب المصدر — ليس تصريح صرف محلي"
                : unknown}
          </dd>
          <dt>رمز نوع المصطلح في المصدر</dt>
          <dd>
            <bdi>{data.termType || unknown}</bdi>
          </dd>
        </dl>
        <h3>المواد المرتبطة بالسجل من المصدر</h3>
        {data.ingredients.length ? (
          <ul>
            {data.ingredients.map(item => (
              <li key={item.externalId}>
                <span lang={item.language} dir="auto">
                  {item.name}
                </span>
                <p>
                  القوة / التركيز: <bdi>{item.strength ?? unknown}</bdi>
                </p>
                <p>
                  معرّف المصدر للمادة: <bdi>{item.externalId}</bdi>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            المادة الفعالة والقوة / التركيز: غير معروف من البيانات المتاحة؛ لا
            نستنتجهما من الاسم.
          </p>
        )}
      </article>
      <section className="medication-knowledge__card">
        <h2>التسجيل والسعر والتوفر</h2>
        <p>
          التسجيل الأردني:{" "}
          {jordan.length ? "تتوفر بيانات تسجيل موثقة أدناه" : unknown}
        </p>
        <p>
          {sourcedPrice
            ? `السعر الأردني من المصدر: ${sourcedPrice.priceJod} JOD`
            : "السعر الأردني: غير معروف"}
        </p>
        <p>التوفر المحلي: غير معروف</p>
        <p>
          هذه البيانات مستقلة عن منتجات المتجر ومخزونه وأسعاره، ولا تعني إمكانية
          الشراء.
        </p>
        {verified.map(row => (
          <article className="medication-knowledge__registration" key={row.id}>
            <h3>
              بيانات تسجيل موثقة — <bdi>{row.country}</bdi>
            </h3>
            <p>الجهة: {row.authority}</p>
            <p>
              رقم التسجيل: <bdi>{row.registrationNumber}</bdi>
            </p>
            <p>العبوة: {row.packageDescription ?? unknown}</p>
            <p>
              مصدر التسجيل: <SourceReference value={row.sourceReference} />
            </p>
            <p>تاريخ التحقق: {timestamp(row.verifiedAt)}</p>
            {row.priceState === "sourced" &&
            row.priceJod !== null &&
            row.priceAsOf &&
            row.priceSourceReference ? (
              <>
                <p>
                  قيمة مصدرية: <bdi>{row.priceJod} JOD</bdi> بتاريخ{" "}
                  {timestamp(row.priceAsOf)}
                </p>
                <p>
                  مصدر السعر:{" "}
                  <SourceReference value={row.priceSourceReference} />
                </p>
              </>
            ) : (
              <p>
                السعر: غير معروف
                {row.priceState === "stale_or_unverified"
                  ? " — بيانات السعر قديمة أو غير موثقة"
                  : ""}
              </p>
            )}
          </article>
        ))}
      </section>
      <section className="medication-knowledge__card">
        <h2>
          النصوص المرجعية المراجعة — {language === "ar" ? "العربية" : "English"}
        </h2>
        {reviewed.length ? (
          reviewed.map((label, index) => (
            <article key={index}>
              <h3>
                {sectionNames[label.section as keyof typeof sectionNames]}
              </h3>
              <p
                className="medication-knowledge__label"
                lang={label.language}
                dir={label.language === "ar" ? "rtl" : "ltr"}
              >
                {label.content}
              </p>
              <small>تاريخ المراجعة: {timestamp(label.reviewedAt)}</small>
            </article>
          ))
        ) : (
          <p>
            لا تتوفر نصوص طبية مراجعة بهذه اللغة. لا ننشئ ترجمة أو إرشادات جرعات
            تلقائياً.
          </p>
        )}
      </section>
      <section className="medication-knowledge__card">
        <h2>المصدر وحدود المراجعة</h2>
        <dl className="medication-knowledge__facts">
          <dt>المصدر</dt>
          <dd>{data.source.title}</dd>
          <dt>معرّف السجل بالمصدر</dt>
          <dd>
            <bdi>{data.externalId}</bdi>
          </dd>
          <dt>نوع المصدر</dt>
          <dd>
            {data.source.scope === "international_vocabulary"
              ? "قاموس مصطلحات دولي؛ ليس اعتماداً طبياً أو محلياً"
              : "مصدر منظم مع مراجعة مستقلة للبيانات المنشورة"}
          </dd>
          <dt>نسخة المصدر</dt>
          <dd>
            <bdi>{data.source.version ?? unknown}</bdi>
          </dd>
          <dt>نسخة السجل المحلية</dt>
          <dd>{data.version}</dd>
          <dt>آخر تحديث للسجل المحلي</dt>
          <dd>{timestamp(data.updatedAt)}</dd>
          <dt>تاريخ الاستيراد</dt>
          <dd>{timestamp(data.source.importedAt)}</dd>
          <dt>مرجع السجل</dt>
          <dd>
            <SourceReference value={data.source.reference} />
          </dd>
          <dt>موقع المصدر</dt>
          <dd>
            <SourceReference value={data.source.homepage} />
          </dd>
          <dt>شروط المصدر</dt>
          <dd>
            <SourceReference value={data.source.termsReference} />
          </dd>
        </dl>
      </section>
      {data.source.code === "rxnorm" && <NlmAttribution />}
    </>
  );
}
function knowledgeFailure(error: unknown) {
  return (error as { data?: { code?: string } } | null)?.data?.code ===
    "NOT_FOUND"
    ? "السجل غير موجود أو غير منشور في هذا الدليل."
    : "تعذر تحميل البيانات المصدرية. تحقق من اتصالك وأعد المحاولة.";
}
export default function MedicationKnowledge() {
  const [path, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const country =
    params.get("country") === "international" ? "international" : "JO";
  const q = (params.get("q") ?? "").slice(0, 100);
  const [draft, setDraft] = useState(q);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const match = /^\/medicines\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  useEffect(() => setDraft(q), [q]);
  const results = trpc.medicationKnowledge.search.useQuery(
    { q, country, limit: 20 },
    { enabled: !id, retry: false }
  );
  const detail = trpc.medicationKnowledge.detail.useQuery(
    { id, language },
    { enabled: !!id, retry: false }
  );
  const target = (scope: "JO" | "international", term: string) =>
    `/medicines?country=${scope}&q=${encodeURIComponent(term.trim())}`;
  return (
    <main className="medication-knowledge" dir="rtl">
      <header>
        <h1>دليل معلومات الأدوية</h1>
        <Link href="/products">العودة للمنتجات</Link>
      </header>
      <p className="medication-knowledge__intro">
        اطّلع على بيانات المصادر المنشورة دون استنتاج تسجيل محلي أو سعر أو توفر.
        استشر الطبيب أو الصيدلي؛ هذا الدليل لا يصف علاجاً أو جرعات.
      </p>
      {id ? (
        <>
          <Link
            className="medication-knowledge__back"
            href={target(country, q)}
          >
            العودة لنتائج الدليل
          </Link>
          <label className="medication-knowledge__language">
            لغة النصوص المرجعية
            <select
              value={language}
              onChange={event => setLanguage(event.target.value as "ar" | "en")}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          {detail.isPending || detail.isFetching ? (
            <p role="status">جار تحميل السجل ومصادره…</p>
          ) : detail.error ? (
            <div role="alert">
              <p>{knowledgeFailure(detail.error)}</p>
              <button type="button" onClick={() => detail.refetch()}>
                إعادة المحاولة
              </button>
            </div>
          ) : detail.data ? (
            <KnowledgeDetailContent data={detail.data} language={language} />
          ) : null}
        </>
      ) : (
        <>
          <form
            className="medication-knowledge__search"
            role="search"
            onSubmit={event => {
              event.preventDefault();
              navigate(target(country, draft));
            }}
          >
            <label>
              ابحث في البيانات المستوردة من المصادر
              <input
                type="search"
                value={draft}
                maxLength={100}
                placeholder="اسم دواء أو مادة كما ورد بالمصدر"
                onChange={event => setDraft(event.target.value)}
              />
            </label>
            <button type="submit">بحث في الدليل</button>
            <label>
              نطاق البيانات
              <select
                value={country}
                onChange={event =>
                  navigate(
                    target(event.target.value as "JO" | "international", draft)
                  )
                }
              >
                <option value="JO">الأردن — تسجيل موثق</option>
                <option value="international">دولي — مصطلحات مصدرية</option>
              </select>
            </label>
          </form>
          <KnowledgeScopeNotice country={country} />
          {country === "international" && (
            <p>
              قد تكون الأسماء المتاحة بالإنجليزية فقط. البحث يشمل مجموعة مصدرية
              مستوردة محدودة، وليس جميع الأدوية أو جميع بلدان العالم.
            </p>
          )}
          {results.isPending || results.isFetching ? (
            <p role="status">جار البحث في بيانات المصدر…</p>
          ) : results.error ? (
            <div role="alert">
              <p>{knowledgeFailure(results.error)}</p>
              <button type="button" onClick={() => results.refetch()}>
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <>
              <p role="status">
                النتائج المعروضة: {results.data?.length ?? 0} — حد أقصى 20 نتيجة
                لكل بحث.
              </p>
              {!results.data?.length ? (
                <p className="medication-knowledge__empty">
                  {country === "JO"
                    ? "لا توجد سجلات مطابقة لديها تسجيل أردني موثق ضمن البيانات المتاحة. هذا لا يثبت عدم تسجيل دواء بعينه؛ راجع المصدر المحلي المختص."
                    : "لا توجد سجلات مطابقة في المجموعة الدولية المستوردة. جرّب الاسم الأصلي كما ورد بالمصدر."}
                </p>
              ) : (
                <ul className="medication-knowledge__results">
                  {results.data.map(row => (
                    <li key={row.id}>
                      <Link
                        href={`/medicines/${row.id}?country=${country}&q=${encodeURIComponent(q)}`}
                      >
                        <strong dir="auto">{row.name}</strong>
                        <span>المصدر: {row.sourceTitle}</span>
                        <span>
                          {row.scope === "JO"
                            ? "نطاق التسجيل الأردني الموثق"
                            : "مصطلح دولي — لا يثبت التسجيل الأردني"}
                        </span>
                        <small>
                          آخر تحديث محلي: {timestamp(row.updatedAt)}
                        </small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <NlmAttribution />
        </>
      )}
    </main>
  );
}
