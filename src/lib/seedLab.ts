import { collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { db } from './firebase';

const yemenLabTests = [
  {
    name: 'صورة الدم الكاملة (CBC)',
    category: 'Hematology',
    price: 2500,
    items: [
      { name: 'WBC', unit: '10^3/uL', normalRange: '4.0 - 11.0' },
      { name: 'RBC', unit: '10^6/uL', normalRange: '4.5 - 5.5' },
      { name: 'HGB', unit: 'g/dL', normalRange: '13.0 - 17.0' },
      { name: 'HCT', unit: '%', normalRange: '40 - 50' },
      { name: 'PLT', unit: '10^3/uL', normalRange: '150 - 450' }
    ]
  },
  {
    name: 'فحص الملاريا (Malaria Test)',
    category: 'Parasitology',
    price: 1500,
    items: [
      { name: 'Malaria Parasite', unit: '', normalRange: 'Negative' }
    ]
  },
  {
    name: 'فحص حمى الضنك (Dengue NS1)',
    category: 'Serology',
    price: 5000,
    items: [
      { name: 'Dengue NS1 Antigen', unit: '', normalRange: 'Negative' }
    ]
  },
  {
    name: 'وظائف الكبد (LFT)',
    category: 'Biochemistry',
    price: 6000,
    items: [
      { name: 'ALT (SGPT)', unit: 'U/L', normalRange: 'Up to 41' },
      { name: 'AST (SGOT)', unit: 'U/L', normalRange: 'Up to 40' },
      { name: 'Albumin', unit: 'g/dL', normalRange: '3.5 - 5.2' },
      { name: 'Total Bilirubin', unit: 'mg/dL', normalRange: '0.1 - 1.2' }
    ]
  },
  {
    name: 'وظائف الكلى (RFT)',
    category: 'Biochemistry',
    price: 4000,
    items: [
      { name: 'Creatinine', unit: 'mg/dL', normalRange: '0.7 - 1.3' },
      { name: 'Urea', unit: 'mg/dL', normalRange: '10 - 50' },
      { name: 'Uric Acid', unit: 'mg/dL', normalRange: '3.4 - 7.0' }
    ]
  },
  {
    name: 'سكر الدم (Fasting Blood Sugar)',
    category: 'Biochemistry',
    price: 1000,
    items: [
      { name: 'Glucose (Fasting)', unit: 'mg/dL', normalRange: '70 - 110' }
    ]
  },
  {
    name: 'فحص التيفوئيد (Widal Test)',
    category: 'Serology',
    price: 2000,
    items: [
      { name: 'S. Typhi O', unit: 'Titre', normalRange: '< 1:80' },
      { name: 'S. Typhi H', unit: 'Titre', normalRange: '< 1:80' }
    ]
  },
  {
    name: 'فحص البول الكامل (General Urine Analysis)',
    category: 'Clinical Pathology',
    price: 1000,
    items: [
      { name: 'Color', unit: '', normalRange: 'Pale Yellow' },
      { name: 'Aspect', unit: '', normalRange: 'Clear' },
      { name: 'Pus Cells', unit: '/HPF', normalRange: '0 - 5' },
      { name: 'RBCs', unit: '/HPF', normalRange: '0 - 2' },
      { name: 'Sugar', unit: '', normalRange: 'Nil' },
      { name: 'Albumin', unit: '', normalRange: 'Nil' }
    ]
  },
  {
    name: 'فحص البراز الكامل (General Stool Analysis)',
    category: 'Parasitology',
    price: 1000,
    items: [
      { name: 'Consistency', unit: '', normalRange: 'Formed' },
      { name: 'Parasites', unit: '', normalRange: 'Not Found' },
      { name: 'Pus Cells', unit: '/HPF', normalRange: '0 - 2' }
    ]
  },
  {
    name: 'فحص الكوليسترول (Lipid Profile)',
    category: 'Biochemistry',
    price: 7000,
    items: [
      { name: 'Total Cholesterol', unit: 'mg/dL', normalRange: '< 200' },
      { name: 'Triglycerides', unit: 'mg/dL', normalRange: '< 150' },
      { name: 'HDL Cholesterol', unit: 'mg/dL', normalRange: '> 40' },
      { name: 'LDL Cholesterol', unit: 'mg/dL', normalRange: '< 130' }
    ]
  }
];

export async function seedLabCatalog() {
  try {
    const catalogRef = collection(db, 'lab_catalog');
    const existing = await getDocs(query(catalogRef, limit(1)));
    
    if (!existing.empty) {
      console.log('Lab catalog already contains data. Skipping seed.');
      return;
    }

    console.log('Seeding Yemen Lab Tests...');
    for (const test of yemenLabTests) {
      await addDoc(catalogRef, {
        ...test,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding lab catalog:', error);
  }
}
