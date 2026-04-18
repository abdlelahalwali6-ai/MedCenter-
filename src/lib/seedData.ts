import { collection, addDoc, serverTimestamp, getDocs, query, limit, setDoc, doc, where } from 'firebase/firestore';
import { db } from './firebase';

const yemenMedications = [
  { name: 'Amoxicillin 500mg', category: 'medication', unit: 'Capsule', price: 100, quantity: 500, minThreshold: 50 },
  { name: 'Paracetamol 500mg', category: 'medication', unit: 'Tablet', price: 20, quantity: 1000, minThreshold: 100 },
  { name: 'Ciprofloxacin 500mg', category: 'medication', unit: 'Tablet', price: 150, quantity: 200, minThreshold: 30 },
  { name: 'Omeprazole 20mg', category: 'medication', unit: 'Capsule', price: 80, quantity: 300, minThreshold: 40 },
  { name: 'Metformin 500mg', category: 'medication', unit: 'Tablet', price: 50, quantity: 400, minThreshold: 50 },
  { name: 'Amlodipine 5mg', category: 'medication', unit: 'Tablet', price: 60, quantity: 300, minThreshold: 30 },
  { name: 'Diclofenac Sodium 50mg', category: 'medication', unit: 'Tablet', price: 40, quantity: 500, minThreshold: 50 },
  { name: 'Azithromycin 500mg', category: 'medication', unit: 'Tablet', price: 300, quantity: 100, minThreshold: 20 },
  { name: 'Salbutamol Inhaler', category: 'medication', unit: 'Inhaler', price: 2500, quantity: 50, minThreshold: 10 },
  { name: 'Insulin Mixtard', category: 'medication', unit: 'Vial', price: 4500, quantity: 30, minThreshold: 5 }
];

const yemenRadiologyTypes = [
  { name: 'X-Ray Chest (PA)', category: 'X-Ray', price: 3000 },
  { name: 'X-Ray Hand/Foot', category: 'X-Ray', price: 2500 },
  { name: 'Ultrasound Abdomen', category: 'Ultrasound', price: 5000 },
  { name: 'Ultrasound Pelvis', category: 'Ultrasound', price: 4500 },
  { name: 'CT Scan Brain', category: 'CT Scan', price: 25000 },
  { name: 'CT Scan Abdomen', category: 'CT Scan', price: 35000 },
  { name: 'MRI Brain', category: 'MRI', price: 45000 },
  { name: 'MRI Spine', category: 'MRI', price: 50000 },
  { name: 'Dental X-Ray (OPG)', category: 'X-Ray', price: 4000 },
  { name: 'Echocardiogram', category: 'Ultrasound', price: 8000 }
];

const yemenServices = [
  { name: 'غيار جرح بسيط', category: 'Nursing', price: 1000, description: 'تنظيف وتغيير ضماد لجرح بسيط' },
  { name: 'غيار جرح كبير', category: 'Nursing', price: 2500, description: 'تنظيف وتغيير ضماد لجرح كبير أو عميق' },
  { name: 'حقنة عضلية', category: 'Nursing', price: 500, description: 'ضرب إبرة في العضل' },
  { name: 'حقنة وريدية', category: 'Nursing', price: 1000, description: 'ضرب إبرة في الوريد' },
  { name: 'تركيب مغذية (دريب)', category: 'Nursing', price: 3000, description: 'تركيب كانيولا ومحلول وريدي' },
  { name: 'جلسة بخار (نيبولايزر)', category: 'Nursing', price: 1500, description: 'جلسة استنشاق بخار لمرضى الصدر' },
  { name: 'خياطة جرح (غرزة واحدة)', category: 'Emergency', price: 2000, description: 'خياطة جرح بسيط' },
  { name: 'فحص سكر سريع', category: 'General', price: 500, description: 'فحص سكر الدم بجهاز الفحص السريع' },
  { name: 'قياس ضغط الدم', category: 'General', price: 200, description: 'قياس ضغط الدم الشرياني' },
  { name: 'تخطيط قلب (ECG)', category: 'General', price: 5000, description: 'عمل رسم قلب كهربائي' }
];

const yemenDoctors = [
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
  }
];

export async function seedDoctors() {
  try {
    const usersRef = collection(db, 'users');
    const existing = await getDocs(query(usersRef, where('role', '==', 'doctor'), limit(1)));
    
    if (existing.empty) {
      console.log('Seeding Sample Yemen Doctors...');
      for (const doctor of yemenDoctors) {
        // We create Firestore profiles. Note: These won't have actual Auth accounts
        // but it's enough for the Admin to see them in management views.
        const tempId = 'demo-dr-' + Math.random().toString(36).substring(7);
        await setDoc(doc(db, 'users', tempId), {
          ...doctor,
          uid: tempId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Error seeding doctors:', error);
  }
}

export async function seedPharmacyAndRadiology() {
  try {
    // Seed Pharmacy
    const inventoryRef = collection(db, 'inventory');
    const invExisting = await getDocs(query(inventoryRef, limit(1)));
    if (invExisting.empty) {
      console.log('Seeding Yemen Medications...');
      for (const med of yemenMedications) {
        await addDoc(inventoryRef, { ...med, updatedAt: serverTimestamp() });
      }
    }

    // Seed Radiology Catalog
    const radCatalogRef = collection(db, 'radiology_catalog');
    const radExisting = await getDocs(query(radCatalogRef, limit(1)));
    if (radExisting.empty) {
      console.log('Seeding Yemen Radiology Types...');
      for (const rad of yemenRadiologyTypes) {
        await addDoc(radCatalogRef, { ...rad, createdAt: serverTimestamp() });
      }
    }

    // Seed Services Catalog
    const servicesRef = collection(db, 'services_catalog');
    const servicesExisting = await getDocs(query(servicesRef, limit(1)));
    if (servicesExisting.empty) {
      console.log('Seeding Yemen Services...');
      for (const service of yemenServices) {
        await addDoc(servicesRef, { ...service, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    }
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}
