
import { collection, addDoc, serverTimestamp, getDocs, query, limit, setDoc, doc, where } from 'firebase/firestore';
import { db } from './firebase';

// --- USERS (STAFF) ---
const staffProfiles = [
  // Doctors
  {
    displayName: 'د. أحمد الوالي',
    email: 'dr.ahmed@medcare.ye',
    role: 'doctor',
    specialization: 'العيادة العامة',
    consultationFee: 3000,
    freeFollowUps: 1,
    availableDays: ['Saturday', 'Monday', 'Wednesday'],
    workingHours: { start: '08:00', end: '14:00' }
  },
  {
    displayName: 'د. مريم الصبري',
    email: 'dr.mariam@medcare.ye',
    role: 'doctor',
    specialization: 'طب الأطفال',
    consultationFee: 4000,
    freeFollowUps: 1,
    availableDays: ['Sunday', 'Tuesday', 'Thursday'],
    workingHours: { start: '09:00', end: '15:00' }
  },
  {
    displayName: 'د. فؤاد عقلان',
    email: 'dr.fouad@medcare.ye',
    role: 'doctor',
    specialization: 'الأسنان',
    consultationFee: 5000,
    freeFollowUps: 0,
    availableDays: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
    workingHours: { start: '16:00', end: '21:00' }
  },
  // Nurses
  {
    displayName: 'ممرض/ة. فاطمة قائد',
    email: 'nurse.fatima@medcare.ye',
    role: 'nurse',
    shift: 'Morning'
  },
  // Receptionists
  {
    displayName: 'استقبال. علي الحيمي',
    email: 'recep.ali@medcare.ye',
    role: 'receptionist',
    shift: 'Evening'
  },
  // Pharmacists
  {
    displayName: 'صيدلي/ة. خالد عبدالله',
    email: 'pharm.khaled@medcare.ye',
    role: 'pharmacist',
    shift: 'Full-Time'
  },
  // Lab Technicians
  {
    displayName: 'فني/ة مختبر. سارة محسن',
    email: 'lab.sarah@medcare.ye',
    role: 'lab_tech',
    specialization: 'Hematology'
  }
];

// --- PHARMACY & INVENTORY ---
const yemenMedications = [
  { name: 'Amoxicillin 500mg', category: 'Antibiotics', unit: 'Capsule', price: 100, quantity: 500, minThreshold: 50 },
  { name: 'Paracetamol 500mg', category: 'Analgesics', unit: 'Tablet', price: 20, quantity: 1000, minThreshold: 100 },
  { name: 'Ciprofloxacin 500mg', category: 'Antibiotics', unit: 'Tablet', price: 150, quantity: 200, minThreshold: 30 },
  { name: 'Omeprazole 20mg', category: 'Gastrointestinal', unit: 'Capsule', price: 80, quantity: 300, minThreshold: 40 },
  { name: 'Metformin 500mg', category: 'Diabetes', unit: 'Tablet', price: 50, quantity: 400, minThreshold: 50 },
  { name: 'Amlodipine 5mg', category: 'Cardiovascular', unit: 'Tablet', price: 60, quantity: 300, minThreshold: 30 },
  { name: 'Diclofenac Sodium 50mg', category: 'Analgesics', unit: 'Tablet', price: 40, quantity: 500, minThreshold: 50 },
  { name: 'Azithromycin 500mg', category: 'Antibiotics', unit: 'Tablet', price: 300, quantity: 100, minThreshold: 20 },
  { name: 'Salbutamol Inhaler', category: 'Respiratory', unit: 'Inhaler', price: 2500, quantity: 50, minThreshold: 10 },
  { name: 'Insulin Mixtard', category: 'Diabetes', unit: 'Vial', price: 4500, quantity: 30, minThreshold: 5 },
  { name: 'ORS Sachets', category: 'Gastrointestinal', unit: 'Sachet', price: 150, quantity: 200, minThreshold: 25 },
  { name: 'Vitamin C 500mg', category: 'Vitamins', unit: 'Tablet', price: 30, quantity: 600, minThreshold: 100 },
  { name: 'Folic Acid 5mg', category: 'Vitamins', unit: 'Tablet', price: 25, quantity: 400, minThreshold: 50 },
];

// --- RADIOLOGY ---
const yemenRadiologyTypes = [
  { name: 'X-Ray Chest (PA)', category: 'X-Ray', price: 3000 },
  { name: 'X-Ray Hand/Foot', category: 'X-Ray', price: 2500 },
  { name: 'X-Ray Skull', category: 'X-Ray', price: 3500 },
  { name: 'Ultrasound Abdomen', category: 'Ultrasound', price: 5000 },
  { name: 'Ultrasound Pelvis', category: 'Ultrasound', price: 4500 },
  { name: 'Ultrasound Pregnancy', category: 'Ultrasound', price: 6000 },
  { name: 'CT Scan Brain', category: 'CT Scan', price: 25000 },
  { name: 'CT Scan Abdomen with Contrast', category: 'CT Scan', price: 35000 },
  { name: 'MRI Brain', category: 'MRI', price: 45000 },
  { name: 'MRI Spine', category: 'MRI', price: 50000 },
  { name: 'Dental X-Ray (OPG)', category: 'X-Ray', price: 4000 },
  { name: 'Echocardiogram', category: 'Ultrasound', price: 8000 },
];

// --- GENERAL SERVICES ---
const yemenServices = [
  { name: 'غيار جرح بسيط', category: 'Nursing', price: 1000, description: 'تنظيف وتغيير ضماد لجرح بسيط' },
  { name: 'غيار جرح كبير', category: 'Nursing', price: 2500, description: 'تنظيف وتغيير ضماد لجرح كبير أو عميق' },
  { name: 'حقنة عضلية', category: 'Nursing', price: 500, description: 'إعطاء حقنة في العضل' },
  { name: 'حقنة وريدية', category: 'Nursing', price: 1000, description: 'إعطاء حقنة في الوريد' },
  { name: 'تركيب مغذية (drip)', category: 'Nursing', price: 3000, description: 'تركيب كانيولا ومحلول وريدي' },
  { name: 'جلسة بخار (nebulizer)', category: 'Nursing', price: 1500, description: 'جلسة استنشاق بخار لمرضى الصدر' },
  { name: 'خياطة جرح (لكل غرزة)', category: 'Emergency', price: 2000, description: 'خياطة جرح بسيط' },
  { name: 'فحص سكر سريع', category: 'General', price: 500, description: 'فحص سكر الدم بجهاز الفحص السريع' },
  { name: 'قياس ضغط الدم', category: 'General', price: 200, description: 'قياس ضغط الدم الشرياني' },
  { name: 'تخطيط قلب (ECG)', category: 'Cardiology', price: 5000, description: 'عمل رسم قلب كهربائي' },
  { name: 'إزالة غرز جراحية', category: 'Nursing', price: 1500, description: 'فك الغرز بعد التئام الجرح' },
];

// --- SEEDING FUNCTIONS ---

export async function seedStaff() {
  try {
    const usersRef = collection(db, 'users');
    console.log('Checking for existing staff profiles...');
    
    // Check if any staff member exists to avoid re-seeding
    const q = query(usersRef, where('role', '!=', 'patient'), limit(1));
    const existing = await getDocs(q);
    
    if (existing.empty) {
      console.log('Seeding sample staff profiles...');
      for (const profile of staffProfiles) {
        // These are demo profiles and won't have actual Firebase Auth accounts
        // but it's enough for an Admin to see and manage them.
        const tempId = 'demo-' + profile.role + '-' + Math.random().toString(36).substring(2, 9);
        await setDoc(doc(db, 'users', tempId), {
          ...profile,
          uid: tempId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log('Staff profiles seeded.');
    } else {
      console.log('Staff profiles already exist. Skipping.');
    }
  } catch (error) {
    console.error('Error seeding staff:', error);
  }
}

export async function seedCatalogs() {
  try {
    // Seed Pharmacy
    const inventoryRef = collection(db, 'inventory');
    const invExisting = await getDocs(query(inventoryRef, limit(1)));
    if (invExisting.empty) {
      console.log('Seeding medications...');
      for (const med of yemenMedications) {
        await addDoc(inventoryRef, { ...med, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    }

    // Seed Radiology Catalog
    const radCatalogRef = collection(db, 'radiology_catalog');
    const radExisting = await getDocs(query(radCatalogRef, limit(1)));
    if (radExisting.empty) {
      console.log('Seeding radiology types...');
      for (const rad of yemenRadiologyTypes) {
        await addDoc(radCatalogRef, { ...rad, createdAt: serverTimestamp() });
      }
    }

    // Seed Services Catalog
    const servicesRef = collection(db, 'services_catalog');
    const servicesExisting = await getDocs(query(servicesRef, limit(1)));
    if (servicesExisting.empty) {
      console.log('Seeding general services...');
      for (const service of yemenServices) {
        await addDoc(servicesRef, { ...service, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    }
    console.log('Catalogs seeding check complete.');
  } catch (error) {
    console.error('Error seeding catalogs:', error);
  }
}

// Keeping old functions for compatibility if they are called from elsewhere,
// but they are now replaced by the more comprehensive functions above.
export const seedDoctors = seedStaff;
export const seedPharmacyAndRadiology = seedCatalogs;
