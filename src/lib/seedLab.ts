import { collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { db } from './firebase';

const yemenLabTests = [
  // Hematology
  {
    name: 'صورة الدم الكاملة (CBC)',
    category: 'Hematology',
    price: 2500,
    turnaroundTime: '2-4 hours',
    items: [
      { name: 'WBC', unit: '10^3/uL', normalRange: '4.0 - 11.0' },
      { name: 'RBC', unit: '10^6/uL', normalRange: '4.5 - 5.5' },
      { name: 'HGB', unit: 'g/dL', normalRange: '13.0 - 17.0' },
      { name: 'HCT', unit: '%', normalRange: '40 - 50' },
      { name: 'MCV', unit: 'fL', normalRange: '80 - 100' },
      { name: 'MCH', unit: 'pg', normalRange: '27 - 33' },
      { name: 'PLT', unit: '10^3/uL', normalRange: '150 - 450' }
    ]
  },
  {
    name: 'سرعة الترسيب (ESR)',
    category: 'Hematology',
    price: 1000,
    turnaroundTime: '1 hour',
    items: [
      { name: 'ESR', unit: 'mm/hr', normalRange: '0 - 20' },
    ]
  },

  // Biochemistry
  {
    name: 'وظائف الكبد (LFT)',
    category: 'Biochemistry',
    price: 6000,
    turnaroundTime: '4-6 hours',
    items: [
      { name: 'ALT (SGPT)', unit: 'U/L', normalRange: 'Up to 41' },
      { name: 'AST (SGOT)', unit: 'U/L', normalRange: 'Up to 40' },
      { name: 'Alkaline Phosphatase', unit: 'U/L', normalRange: '30 - 120' },
      { name: 'Albumin', unit: 'g/dL', normalRange: '3.5 - 5.2' },
      { name: 'Total Bilirubin', unit: 'mg/dL', normalRange: '0.1 - 1.2' },
      { name: 'Direct Bilirubin', unit: 'mg/dL', normalRange: '0.0 - 0.3' }
    ]
  },
  {
    name: 'وظائف الكلى (RFT)',
    category: 'Biochemistry',
    price: 4000,
    turnaroundTime: '4-6 hours',
    items: [
      { name: 'Creatinine', unit: 'mg/dL', normalRange: '0.7 - 1.3' },
      { name: 'Urea', unit: 'mg/dL', normalRange: '10 - 50' },
      { name: 'Uric Acid', unit: 'mg/dL', normalRange: '3.4 - 7.0' }
    ]
  },
  {
    name: 'فحص الكوليسترول (Lipid Profile)',
    category: 'Biochemistry',
    price: 7000,
    turnaroundTime: '6-8 hours',
    items: [
      { name: 'Total Cholesterol', unit: 'mg/dL', normalRange: '< 200' },
      { name: 'Triglycerides', unit: 'mg/dL', normalRange: '< 150' },
      { name: 'HDL Cholesterol', unit: 'mg/dL', normalRange: '> 40' },
      { name: 'LDL Cholesterol', unit: 'mg/dL', normalRange: '< 130' }
    ]
  },
  {
    name: 'سكر الدم (Fasting Blood Sugar)',
    category: 'Biochemistry',
    price: 1000,
    turnaroundTime: '1-2 hours',
    items: [
      { name: 'Glucose (Fasting)', unit: 'mg/dL', normalRange: '70 - 110' }
    ]
  },
  {
    name: 'السكر التراكمي (HbA1c)',
    category: 'Biochemistry',
    price: 4500,
    turnaroundTime: '24 hours',
    items: [
      { name: 'HbA1c', unit: '%', normalRange: '4.0 - 5.6' }
    ]
  },
  
  // Serology & Parasitology
  {
    name: 'فحص الملاريا (Malaria Smear)',
    category: 'Parasitology',
    price: 1500,
    turnaroundTime: '2-3 hours',
    items: [
      { name: 'Malaria Parasite', unit: '', normalRange: 'Negative' }
    ]
  },
  {
    name: 'فحص حمى الضنك (Dengue NS1)',
    category: 'Serology',
    price: 5000,
    turnaroundTime: '3-4 hours',
    items: [
      { name: 'Dengue NS1 Antigen', unit: '', normalRange: 'Negative' }
    ]
  },
  {
    name: 'فحص التيفوئيد (Widal Test)',
    category: 'Serology',
    price: 2000,
    turnaroundTime: '4-6 hours',
    items: [
      { name: 'S. Typhi O', unit: 'Titre', normalRange: '< 1:80' },
      { name: 'S. Typhi H', unit: 'Titre', normalRange: '< 1:80' }
    ]
  },
  {
    name: 'فحص الحمل (Serum HCG)',
    category: 'Serology',
    price: 3000,
    turnaroundTime: '2-4 hours',
    items: [
      { name: 'Beta-HCG', unit: 'mIU/mL', normalRange: '< 5' }
    ]
  },

  // Clinical Pathology
  {
    name: 'فحص البول الكامل (General Urine Analysis)',
    category: 'Clinical Pathology',
    price: 1000,
    turnaroundTime: '1-2 hours',
    items: [
      { name: 'Color', unit: '', normalRange: 'Pale Yellow' },
      { name: 'Aspect', unit: '', normalRange: 'Clear' },
      { name: 'pH', unit: '', normalRange: '4.5 - 8.0' },
      { name: 'Pus Cells', unit: '/HPF', normalRange: '0 - 5' },
      { name: 'RBCs', unit: '/HPF', normalRange: '0 - 2' },
      { name: 'Casts', unit: '/LPF', normalRange: 'Nil' },
      { name: 'Crystals', unit: '', normalRange: 'Nil' },
      { name: 'Sugar', unit: '', normalRange: 'Nil' },
      { name: 'Albumin', unit: '', normalRange: 'Nil' }
    ]
  },
  {
    name: 'فحص البراز الكامل (General Stool Analysis)',
    category: 'Parasitology',
    price: 1000,
    turnaroundTime: '2-3 hours',
    items: [
      { name: 'Consistency', unit: '', normalRange: 'Formed' },
      { name: 'Color', unit: '', normalRange: 'Brown' },
      { name: 'Mucus', unit: '', normalRange: 'Absent' },
      { name: 'Blood', unit: '', normalRange: 'Absent' },
      { name: 'Ova/Cysts/Parasites', unit: '', normalRange: 'Not Found' },
      { name: 'Pus Cells', unit: '/HPF', normalRange: '0 - 2' },
      { name: 'RBCs', unit: '/HPF', normalRange: '0 - 1' }
    ]
  }
];

export async function seedLabCatalog() {
  try {
    const catalogRef = collection(db, 'lab_catalog');
    const existing = await getDocs(query(catalogRef, limit(1)));
    
    if (existing.empty) {
      console.log('Seeding comprehensive Yemen lab tests...');
      for (const test of yemenLabTests) {
        await addDoc(catalogRef, {
          ...test,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log('Lab catalog seeding completed successfully!');
    } else {
      console.log('Lab catalog already contains data. Skipping seed.');
    }
  } catch (error) {
    console.error('Error seeding lab catalog:', error);
  }
}
