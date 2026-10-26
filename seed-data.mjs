throw new Error('Legacy seed disabled: run pnpm seed:beta with fictional seed confirmation.');
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Sample doctors with correct enum values
const doctors = [
  {
    userId: 1,
    specialty: 'dentistry',
    clinic: 'عيادة الدكتور أحمد',
    qualifications: 'دكتور أسنان متخصص في تقويم الأسنان',
    waitTime: 20,
    consultationFee: 50,
    rating: 4.8,
    reviewCount: 245,
  },
  {
    userId: 1,
    specialty: 'dermatology',
    clinic: 'عيادة الجلدية المتقدمة',
    qualifications: 'استشاري جلدية وتجميل',
    waitTime: 30,
    consultationFee: 60,
    rating: 4.9,
    reviewCount: 312,
  },
  {
    userId: 1,
    specialty: 'orthopedics',
    clinic: 'عيادة العظام والعمود الفقري',
    qualifications: 'متخصص في جراحة العظام',
    waitTime: 25,
    consultationFee: 70,
    rating: 4.7,
    reviewCount: 189,
  },
  {
    userId: 1,
    specialty: 'pediatrics',
    clinic: 'عيادة الأطفال المتخصصة',
    qualifications: 'طبيب أطفال متخصص',
    waitTime: 15,
    consultationFee: 45,
    rating: 4.9,
    reviewCount: 428,
  },
  {
    userId: 1,
    specialty: 'internal_medicine',
    clinic: 'عيادة الباطنية الحديثة',
    qualifications: 'استشاري أمراض باطنية',
    waitTime: 35,
    consultationFee: 65,
    rating: 4.6,
    reviewCount: 267,
  },
  {
    userId: 1,
    specialty: 'cardiology',
    clinic: 'عيادة القلب والأوعية',
    qualifications: 'متخصص في أمراض القلب',
    waitTime: 40,
    consultationFee: 80,
    rating: 4.8,
    reviewCount: 156,
  }
];

try {
  // Insert doctors
  for (const doc of doctors) {
    await connection.execute(
      'INSERT INTO doctors (userId, specialty, clinic, qualifications, waitTime, consultationFee, rating, reviewCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [doc.userId, doc.specialty, doc.clinic, doc.qualifications, doc.waitTime, doc.consultationFee, doc.rating, doc.reviewCount]
    );
  }
  console.log(`✓ تم إضافة ${doctors.length} طبيب`);

  console.log('✓ تم إضافة البيانات التجريبية بنجاح!');
} catch (error) {
  console.error('خطأ:', error.message);
} finally {
  await connection.end();
}
