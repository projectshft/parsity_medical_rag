import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// Generate synthetic FHIR data for testing
const RECORD_COUNT = 1000;

const firstNames = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra"
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"
];

const conditions = [
  { code: "44054006", display: "Type 2 Diabetes Mellitus" },
  { code: "38341003", display: "Hypertension" },
  { code: "195967001", display: "Asthma" },
  { code: "13645005", display: "Chronic Obstructive Pulmonary Disease" },
  { code: "73211009", display: "Diabetes Mellitus" },
  { code: "22298006", display: "Myocardial Infarction" },
  { code: "84114007", display: "Heart Failure" },
  { code: "40930008", display: "Hypothyroidism" },
  { code: "35489007", display: "Depression" },
  { code: "197480006", display: "Anxiety Disorder" },
  { code: "267036007", display: "Dyspnea" },
  { code: "25064002", display: "Headache" },
  { code: "271807003", display: "Fever" },
  { code: "49727002", display: "Cough" },
  { code: "62315008", display: "Diarrhea" }
];

const medications = [
  { code: "860975", display: "Metformin 500mg" },
  { code: "197361", display: "Lisinopril 10mg" },
  { code: "310965", display: "Atorvastatin 20mg" },
  { code: "197380", display: "Metoprolol 25mg" },
  { code: "197381", display: "Amlodipine 5mg" },
  { code: "310964", display: "Omeprazole 20mg" },
  { code: "311989", display: "Levothyroxine 50mcg" },
  { code: "312961", display: "Sertraline 50mg" },
  { code: "197382", display: "Losartan 50mg" },
  { code: "197383", display: "Gabapentin 300mg" },
  { code: "197384", display: "Acetaminophen 500mg" },
  { code: "197385", display: "Ibuprofen 400mg" }
];

const observations = [
  { code: "8867-4", display: "Heart Rate", unit: "beats/min", min: 60, max: 100 },
  { code: "8480-6", display: "Systolic Blood Pressure", unit: "mmHg", min: 90, max: 180 },
  { code: "8462-4", display: "Diastolic Blood Pressure", unit: "mmHg", min: 60, max: 120 },
  { code: "8310-5", display: "Body Temperature", unit: "degF", min: 97, max: 102 },
  { code: "29463-7", display: "Body Weight", unit: "kg", min: 50, max: 120 },
  { code: "8302-2", display: "Body Height", unit: "cm", min: 150, max: 200 },
  { code: "2339-0", display: "Blood Glucose", unit: "mg/dL", min: 70, max: 300 },
  { code: "2571-8", display: "Triglycerides", unit: "mg/dL", min: 50, max: 400 },
  { code: "2093-3", display: "Total Cholesterol", unit: "mg/dL", min: 150, max: 300 },
  { code: "2085-9", display: "HDL Cholesterol", unit: "mg/dL", min: 30, max: 90 },
  { code: "4548-4", display: "Hemoglobin A1c", unit: "%", min: 4, max: 12 }
];

const procedures = [
  { code: "80146002", display: "Appendectomy" },
  { code: "73761001", display: "Colonoscopy" },
  { code: "418285008", display: "Angiography" },
  { code: "387713003", display: "Surgical Procedure" },
  { code: "33879002", display: "Hip Replacement" },
  { code: "609588000", display: "Knee Replacement" },
  { code: "232717009", display: "Coronary Bypass" },
  { code: "65801008", display: "Excision" }
];

const immunizations = [
  { code: "08", display: "Hepatitis B Vaccine" },
  { code: "140", display: "Influenza Vaccine" },
  { code: "207", display: "COVID-19 Vaccine" },
  { code: "21", display: "Varicella Vaccine" },
  { code: "33", display: "Pneumococcal Vaccine" },
  { code: "115", display: "Tdap Vaccine" }
];

const allergies = [
  { code: "387207008", display: "Ibuprofen" },
  { code: "372687004", display: "Amoxicillin" },
  { code: "373270004", display: "Penicillin" },
  { code: "387517004", display: "Aspirin" },
  { code: "102263004", display: "Eggs" },
  { code: "91935009", display: "Peanuts" },
  { code: "226915003", display: "Latex" },
  { code: "419199007", display: "Shellfish" }
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(yearsAgo: number = 5): string {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * yearsAgo * 365 * 24 * 60 * 60 * 1000);
  return past.toISOString();
}

function randomBirthDate(): string {
  const now = new Date();
  const age = 18 + Math.floor(Math.random() * 70);
  const birthYear = now.getFullYear() - age;
  const birthMonth = Math.floor(Math.random() * 12);
  const birthDay = Math.floor(Math.random() * 28) + 1;
  return `${birthYear}-${String(birthMonth + 1).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
}

function generatePatient(id: string) {
  return {
    resourceType: "Patient",
    id,
    name: [{
      family: randomItem(lastNames),
      given: [randomItem(firstNames)]
    }],
    gender: Math.random() > 0.5 ? "male" : "female",
    birthDate: randomBirthDate(),
    address: [{
      city: randomItem(["Boston", "New York", "Chicago", "Los Angeles", "Houston", "Phoenix"]),
      state: randomItem(["MA", "NY", "IL", "CA", "TX", "AZ"])
    }]
  };
}

function generateCondition(patientId: string) {
  const condition = randomItem(conditions);
  return {
    resourceType: "Condition",
    id: uuidv4(),
    subject: { reference: `Patient/${patientId}` },
    code: {
      coding: [{ system: "http://snomed.info/sct", code: condition.code, display: condition.display }],
      text: condition.display
    },
    clinicalStatus: {
      coding: [{ code: randomItem(["active", "resolved", "inactive"]) }]
    },
    onsetDateTime: randomDate(3)
  };
}

function generateObservation(patientId: string) {
  const obs = randomItem(observations);
  const value = obs.min + Math.random() * (obs.max - obs.min);
  return {
    resourceType: "Observation",
    id: uuidv4(),
    status: "final",
    subject: { reference: `Patient/${patientId}` },
    code: {
      coding: [{ system: "http://loinc.org", code: obs.code, display: obs.display }],
      text: obs.display
    },
    valueQuantity: {
      value: Math.round(value * 10) / 10,
      unit: obs.unit
    },
    effectiveDateTime: randomDate(1)
  };
}

function generateMedicationRequest(patientId: string) {
  const med = randomItem(medications);
  return {
    resourceType: "MedicationRequest",
    id: uuidv4(),
    status: randomItem(["active", "completed", "stopped"]),
    subject: { reference: `Patient/${patientId}` },
    medicationCodeableConcept: {
      coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: med.code, display: med.display }],
      text: med.display
    },
    authoredOn: randomDate(2),
    dosageInstruction: [{
      text: randomItem(["Take once daily", "Take twice daily", "Take as needed", "Take with food"])
    }]
  };
}

function generateProcedure(patientId: string) {
  const proc = randomItem(procedures);
  return {
    resourceType: "Procedure",
    id: uuidv4(),
    status: "completed",
    subject: { reference: `Patient/${patientId}` },
    code: {
      coding: [{ system: "http://snomed.info/sct", code: proc.code, display: proc.display }],
      text: proc.display
    },
    performedDateTime: randomDate(5)
  };
}

function generateEncounter(patientId: string) {
  const types = ["Outpatient visit", "Emergency Room Visit", "Annual Physical", "Follow-up Visit", "Specialist Consultation"];
  return {
    resourceType: "Encounter",
    id: uuidv4(),
    status: "finished",
    subject: { reference: `Patient/${patientId}` },
    type: [{
      coding: [{ display: randomItem(types) }],
      text: randomItem(types)
    }],
    period: {
      start: randomDate(1)
    }
  };
}

function generateImmunization(patientId: string) {
  const imm = randomItem(immunizations);
  return {
    resourceType: "Immunization",
    id: uuidv4(),
    status: "completed",
    patient: { reference: `Patient/${patientId}` },
    vaccineCode: {
      coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: imm.code, display: imm.display }],
      text: imm.display
    },
    occurrenceDateTime: randomDate(2)
  };
}

function generateAllergyIntolerance(patientId: string) {
  const allergy = randomItem(allergies);
  return {
    resourceType: "AllergyIntolerance",
    id: uuidv4(),
    patient: { reference: `Patient/${patientId}` },
    code: {
      coding: [{ system: "http://snomed.info/sct", code: allergy.code, display: allergy.display }],
      text: allergy.display
    },
    clinicalStatus: {
      coding: [{ code: "active" }]
    }
  };
}

function generateBundle(patientId: string): object {
  const entries: Array<{ resource: object }> = [];

  // Add patient
  entries.push({ resource: generatePatient(patientId) });

  // Add random conditions (1-3)
  const conditionCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < conditionCount; i++) {
    entries.push({ resource: generateCondition(patientId) });
  }

  // Add random observations (2-5)
  const obsCount = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < obsCount; i++) {
    entries.push({ resource: generateObservation(patientId) });
  }

  // Add random medications (0-3)
  const medCount = Math.floor(Math.random() * 4);
  for (let i = 0; i < medCount; i++) {
    entries.push({ resource: generateMedicationRequest(patientId) });
  }

  // Maybe add a procedure (30% chance)
  if (Math.random() < 0.3) {
    entries.push({ resource: generateProcedure(patientId) });
  }

  // Add encounters (1-3)
  const encCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < encCount; i++) {
    entries.push({ resource: generateEncounter(patientId) });
  }

  // Add immunizations (0-3)
  const immCount = Math.floor(Math.random() * 4);
  for (let i = 0; i < immCount; i++) {
    entries.push({ resource: generateImmunization(patientId) });
  }

  // Maybe add allergies (40% chance)
  if (Math.random() < 0.4) {
    const allergyCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < allergyCount; i++) {
      entries.push({ resource: generateAllergyIntolerance(patientId) });
    }
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: entries
  };
}

async function main() {
  const outputDir = path.join(process.cwd(), "fhir");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generating ${RECORD_COUNT} FHIR patient bundles...`);

  for (let i = 0; i < RECORD_COUNT; i++) {
    const patientId = uuidv4();
    const bundle = generateBundle(patientId);
    const filename = path.join(outputDir, `patient_${i + 1}.json`);
    fs.writeFileSync(filename, JSON.stringify(bundle, null, 2));

    if ((i + 1) % 100 === 0) {
      console.log(`Generated ${i + 1}/${RECORD_COUNT} records`);
    }
  }

  console.log(`\nDone! Generated ${RECORD_COUNT} FHIR bundles in ${outputDir}`);
}

main().catch(console.error);
