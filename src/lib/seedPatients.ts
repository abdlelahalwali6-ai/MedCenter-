import { collection, addDoc, serverTimestamp, getDocs, query, where, setDoc, doc, Timestamp } from 'firebase/firestore';
import { db, getNextMRN } from './firebase';

const firstNames = ['أحمد', 'علي', 'محمد', 'سارة', 'فاطمة', 'زينب', 'حسن', 'حسين', 'نورة', 'خالد'];
const lastNames = ['الحيمي', 'الوالي', 'الصبري', 'عقلان', 'المحسني', 'الجبري', 'العمري', 'الزهراني', 'القحطاني', 'الغامدي'];
const cities = ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب'];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export async function seedPatientsAndRecords(patientCount = 15) {
  console.log('Checking for existing patient records...');
  const patientsRef = collection(db, 'patients');
  const q = query(patientsRef, where('isDemo', '==', true));
  const existingPatients = await getDocs(q);

  if (!existingPatients.empty) {
    console.log(`Demo patients already exist. Skipping seeding of ${patientCount} patients.`);
    return;
  }

  console.log(`Seeding ${patientCount} demo patients and their records...`);

  // Get all staff to assign them randomly to encounters
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const doctors = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'doctor');
  const nurses = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'nurse');

  // Get catalogs to create realistic records
  const labCatalogSnapshot = await getDocs(collection(db, 'lab_catalog'));
  const labTests = labCatalogSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  const inventorySnapshot = await getDocs(collection(db, 'inventory'));
  const medications = inventorySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  if (doctors.length === 0) {
      console.error("Cannot seed patient records without any doctors. Please seed staff first.");
      return;
  }

  for (let i = 0; i < patientCount; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const dob = getRandomDate(new Date(1950, 0, 1), new Date(2010, 0, 1));
    
    const newPatient = {
      mrn: await getNextMRN(),
      fullName: `${firstName} ${lastName}`,
      dob: Timestamp.fromDate(dob),
      gender: Math.random() > 0.5 ? 'Male' : 'Female',
      phone: `77${Math.floor(1000000 + Math.random() * 9000000)}`,
      address: `${getRandomElement(cities)}, اليمن`,
      emergencyContact: `71${Math.floor(1000000 + Math.random() * 9000000)}`,
      bloodType: getRandomElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
      isDemo: true, // Flag for easy cleanup
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const patientDocRef = await addDoc(patientsRef, newPatient);
    console.log(`Created patient: ${newPatient.fullName} (${newPatient.mrn})`);

    // --- Create a Clinical Encounter for the patient ---
    const encounterDate = getRandomDate(new Date(2023, 0, 1), new Date());
    const assignedDoctor = getRandomElement(doctors);
    const assignedNurse = getRandomElement(nurses);

    const encounter = {
      patientId: patientDocRef.id,
      mrn: newPatient.mrn,
      doctorId: assignedDoctor.id,
      doctorName: (assignedDoctor as any).displayName,
      nurseId: assignedNurse?.id || null,
      nurseName: (assignedNurse as any)?.displayName || null,
      date: Timestamp.fromDate(encounterDate),
      chiefComplaint: getRandomElement(['صداع وحمى', 'ألم في البطن', 'سعال مستمر', 'إصابة في القدم']),
      vitalSigns: {
        bp: `${Math.floor(110 + Math.random() * 20)}/${Math.floor(70 + Math.random() * 15)}`,
        hr: Math.floor(70 + Math.random() * 20),
        temp: parseFloat((37.0 + Math.random() * 1.5).toFixed(1)),
        rr: Math.floor(16 + Math.random() * 4),
      },
      diagnosis: 'تشخيص مبدئي تحت المراجعة',
      doctorNotes: 'تم فحص المريض وينصح بعمل الفحوصات التالية.',
      status: 'Completed',
      createdAt: serverTimestamp(),
    };

    const encounterDocRef = await addDoc(collection(db, 'clinical_encounters'), encounter);
    console.log(`  -> Created clinical encounter for ${newPatient.fullName}`);

    // --- Create a Lab Order for the encounter ---
    const randomTest = getRandomElement(labTests);
    const labOrder = {
      patientId: patientDocRef.id,
      mrn: newPatient.mrn,
      encounterId: encounterDocRef.id,
      doctorId: assignedDoctor.id,
      doctorName: (assignedDoctor as any).displayName,
      orderDate: Timestamp.fromDate(encounterDate),
      tests: [randomTest.id],
      status: 'Pending',
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'lab_orders'), labOrder);
    console.log(`  -> Created lab order for ${randomTest.name}`);

    // --- Create a Prescription for the encounter ---
    const randomMedication = getRandomElement(medications);
    const prescription = {
        patientId: patientDocRef.id,
        encounterId: encounterDocRef.id,
        doctorId: assignedDoctor.id,
        doctorName: (assignedDoctor as any).displayName,
        date: Timestamp.fromDate(encounterDate),
        medications: [
            {
                medicationId: randomMedication.id,
                name: (randomMedication as any).name,
                dosage: 'قرص واحد مرتين يومياً',
                duration: 'لمدة 5 أيام',
            }
        ],
        status: 'New',
        createdAt: serverTimestamp(),
    }
    await addDoc(collection(db, 'prescriptions'), prescription);
    console.log(`  -> Created prescription for ${(randomMedication as any).name}`);

  }
  console.log('Finished seeding patients and records.');
}
