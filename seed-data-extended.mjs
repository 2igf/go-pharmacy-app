throw new Error('Legacy seed disabled: run pnpm seed:beta with fictional seed confirmation.');
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Extended sample medications
const medications = [
  { name: 'أسبرين 500mg', category: 'medications', price: 1.5, manufacturer: 'Bayer', description: 'مسكن ألم وخافض حرارة', requiresPrescription: false },
  { name: 'إيبوبروفين 400mg', category: 'medications', price: 2.0, manufacturer: 'Ibuprofen Co', description: 'مسكن ألم قوي', requiresPrescription: false },
  { name: 'ديكلوفيناك 50mg', category: 'medications', price: 3.5, manufacturer: 'Pharma Plus', description: 'مضاد التهاب قوي', requiresPrescription: true },
  { name: 'أموكسيسيلين 250mg', category: 'medications', price: 4.0, manufacturer: 'Global Pharma', description: 'مضاد حيوي واسع الطيف', requiresPrescription: true },
  { name: 'فيتامين D3 1000IU', category: 'natural_products', price: 5.5, manufacturer: 'Nature Plus', description: 'فيتامين D للعظام', requiresPrescription: false },
  { name: 'كالسيوم + ماغنيسيوم', category: 'natural_products', price: 6.0, manufacturer: 'Health Plus', description: 'مكمل معادن أساسية', requiresPrescription: false },
  { name: 'زيت جوز الهند العضوي', category: 'natural_products', price: 8.5, manufacturer: 'Organic Nature', description: 'زيت طبيعي 100%', requiresPrescription: false },
  { name: 'شامبو الكيراتين', category: 'skincare', price: 7.0, manufacturer: 'Hair Care Pro', description: 'شامبو لتقوية الشعر', requiresPrescription: false },
  { name: 'كريم الوجه المرطب', category: 'skincare', price: 9.5, manufacturer: 'Beauty Plus', description: 'كريم مرطب للبشرة الجافة', requiresPrescription: false },
  { name: 'ماسك الشعر المغذي', category: 'skincare', price: 6.5, manufacturer: 'Hair Spa', description: 'ماسك تغذية عميقة', requiresPrescription: false },
  { name: 'حليب الأطفال العضوي', category: 'baby_care', price: 11.0, manufacturer: 'Organic Baby', description: 'حليب آمن وطبيعي', requiresPrescription: false },
  { name: 'مناديل الأطفال', category: 'baby_care', price: 3.0, manufacturer: 'Baby Soft', description: 'مناديل ناعمة وآمنة', requiresPrescription: false },
  { name: 'كريم الحفاض', category: 'baby_care', price: 4.5, manufacturer: 'Baby Care', description: 'حماية من الطفح الجلدي', requiresPrescription: false },
  { name: 'مقياس الضغط الرقمي', category: 'medical_supplies', price: 25.0, manufacturer: 'MediTech', description: 'قياس دقيق للضغط', requiresPrescription: false },
  { name: 'جهاز قياس السكر', category: 'medical_supplies', price: 30.0, manufacturer: 'DiabetesCare', description: 'جهاز قياس سكر الدم', requiresPrescription: false },
  { name: 'عصابة ضاغطة', category: 'medical_supplies', price: 5.0, manufacturer: 'Medical Plus', description: 'عصابة ضاغطة للإصابات', requiresPrescription: false },
];

// Extended sample doctors
const doctors = [
  { userId: 1, specialty: 'dentistry', clinic: 'عيادة الدكتور محمد الأسنان', qualifications: 'دكتور أسنان متخصص', waitTime: 15, consultationFee: 45, rating: 4.9, reviewCount: 320 },
  { userId: 1, specialty: 'dermatology', clinic: 'مركز الجلدية الحديث', qualifications: 'استشاري جلدية وتجميل', waitTime: 25, consultationFee: 55, rating: 4.8, reviewCount: 280 },
  { userId: 1, specialty: 'orthopedics', clinic: 'عيادة العظام المتقدمة', qualifications: 'متخصص جراحة العظام', waitTime: 30, consultationFee: 65, rating: 4.7, reviewCount: 210 },
  { userId: 1, specialty: 'pediatrics', clinic: 'عيادة الأطفال الآمنة', qualifications: 'طبيب أطفال متخصص', waitTime: 10, consultationFee: 40, rating: 4.95, reviewCount: 450 },
  { userId: 1, specialty: 'internal_medicine', clinic: 'عيادة الباطنية الشاملة', qualifications: 'استشاري أمراض باطنية', waitTime: 35, consultationFee: 60, rating: 4.6, reviewCount: 290 },
  { userId: 1, specialty: 'cardiology', clinic: 'مركز القلب المتخصص', qualifications: 'استشاري أمراض القلب', waitTime: 40, consultationFee: 75, rating: 4.85, reviewCount: 180 },
  { userId: 1, specialty: 'neurology', clinic: 'عيادة الأعصاب الحديثة', qualifications: 'استشاري أمراض الأعصاب', waitTime: 45, consultationFee: 70, rating: 4.7, reviewCount: 150 },
  { userId: 1, specialty: 'general_practice', clinic: 'عيادة الطب العام الموثوقة', qualifications: 'طبيب عام متمرس', waitTime: 20, consultationFee: 35, rating: 4.8, reviewCount: 380 },
];

try {
  // Insert medications
  for (const med of medications) {
    await connection.execute(
      'INSERT INTO products (name, category, price, manufacturer, description, requiresPrescription) VALUES (?, ?, ?, ?, ?, ?)',
      [med.name, med.category, med.price, med.manufacturer, med.description, med.requiresPrescription]
    );
  }
  console.log(`✓ تم إضافة ${medications.length} دواء إضافي`);

  // Insert doctors
  for (const doc of doctors) {
    await connection.execute(
      'INSERT INTO doctors (userId, specialty, clinic, qualifications, waitTime, consultationFee, rating, reviewCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [doc.userId, doc.specialty, doc.clinic, doc.qualifications, doc.waitTime, doc.consultationFee, doc.rating, doc.reviewCount]
    );
  }
  console.log(`✓ تم إضافة ${doctors.length} طبيب إضافي`);

  console.log('✓ تم إضافة البيانات التجريبية الإضافية بنجاح!');
} catch (error) {
  console.error('خطأ:', error.message);
} finally {
  await connection.end();
}
