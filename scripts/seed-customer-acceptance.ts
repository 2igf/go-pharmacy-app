import mysql from "mysql2/promise";

// Explicitly scoped, additive fictional content. Never accepts the phone database.
const url = process.env.TEST_DATABASE_URL;
if (!url || process.env.DATABASE_URL !== url ||
    !["go_pharmacy_test_v2", "go_pharmacy_test_acceptancev1"].includes(new URL(url).pathname.slice(1)))
  throw new Error("An explicitly selected acceptance/staging test database is required");
const connection = await mysql.createConnection(url);
const fixtures = [
  ["DEMO قبول — عناية بالبشرة", "skincare", 3, "/canva/category-skincare.png", false],
  ["DEMO قبول — مستلزمات الطفل", "baby_care", 1, "/canva/category-baby.png", false],
  ["DEMO قبول — منتج طبيعي غير متوفر", "natural_products", 0, "/canva/category-natural.png", false],
  ["DEMO قبول — مستلزمات اختبار", "medical_supplies", 4, "/canva/category-supplies.png", false],
  ["DEMO قبول — عنصر وصفي محظور", "medications", 2, "/canva/category-medications.png", true],
] as const;
let added = 0;
try {
  await connection.beginTransaction();
  for (const [name, category, stock, image, prescription] of fixtures) {
    const [existing] = await connection.execute<mysql.RowDataPacket[]>("SELECT id FROM products WHERE name = ? LIMIT 1", [name]);
    if (existing.length) continue;
    await connection.execute("INSERT INTO products (name,description,category,price,stock,image,requiresPrescription) VALUES (?,?,?,?,?,?,?)", [
      name, "بيانات قبول خيالية فقط؛ الصورة رمز تصنيف من التصميم وليست صورة منتج حقيقي. السعر 0.10 قيمة اختبار وليست سعرًا رسميًا. لا ادعاءات أو توصيات طبية.",
      category, "0.10", stock, image, prescription,
    ]);
    added++;
  }
  await connection.commit();
  console.log(JSON.stringify({ database: new URL(url!).pathname.slice(1), added, existingRecordsModified: false, officialPricesCreated: false }));
} catch (error) {
  await connection.rollback();
  throw error;
} finally { await connection.end(); }
