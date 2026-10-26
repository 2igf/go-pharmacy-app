import "dotenv/config";
import { products } from "../drizzle/schema";
import { getDb, closeDb } from "../server/db";
if (
  process.env.CONFIRM_FICTIONAL_SEED !== "yes" ||
  process.env.NODE_ENV === "production"
)
  throw new Error(
    "Seed requires CONFIRM_FICTIONAL_SEED=yes and non-production NODE_ENV"
  );
try {
  const db = await getDb();
  await db.transaction(async tx => {
    const existing = await tx
      .select({ id: products.id })
      .from(products)
      .limit(1);
    if (existing.length)
      throw new Error(
        "Seed only supports an empty products table; no existing data changed"
      );
    await tx.insert(products).values([
      {
        name: "DEMO غسول تجريبي",
        price: "4.25",
        category: "skincare",
        stock: 20,
        description: "منتج خيالي للعرض فقط. غير مخصص للبيع أو الاستخدام.",
        manufacturer: "DEMO Fictional Labs",
      },
      {
        name: "DEMO مستلزمات اختبار",
        price: "2.10",
        category: "medical_supplies",
        stock: 15,
        description: "عينة خيالية للمحاكاة فقط.",
      },
      {
        name: "DEMO منتج غير متوفر",
        price: "3.00",
        category: "baby_care",
        stock: 0,
      },
      {
        name: "DEMO منتج يتطلب وصفة — محظور",
        price: "5.00",
        category: "medications",
        stock: 10,
        requiresPrescription: true,
      },
    ]);
  });
  console.log(
    "Fictional catalog seeded. No users, passwords, medical records or fabricated sales created."
  );
} finally {
  await closeDb();
}
