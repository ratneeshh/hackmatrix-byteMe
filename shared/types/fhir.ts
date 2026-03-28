export type FHIRResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Observation'
  | 'Condition'
  | 'MedicationRequest'
  | 'CarePlan'
  | 'Bundle';

export type FHIRCoding = {
  system: string;
  code: string;
  display: string;
};

export type FHIRCodeableConcept = {
  coding: FHIRCoding[];
  text?: string;
};

export type FHIRReference = {
  reference: string;
  display?: string;
};

export type FHIRPatient = {
  resourceType: 'Patient';
  id: string;
  identifier?: { system: string; value: string }[];
  name: { family: string; given: string[] }[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
};

export type FHIREncounter = {
  resourceType: 'Encounter';
  id: string;
  status: 'finished' | 'in-progress' | 'planned';
  class: FHIRCoding;
  period: { start: string; end?: string };
  subject: FHIRReference;
  participant?: { individual: FHIRReference }[];
};

export type FHIRObservation = {
  resourceType: 'Observation';
  id: string;
  status: 'final' | 'preliminary';
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string; system: string; code: string };
  valueString?: string;
};

export type FHIRCondition = {
  resourceType: 'Condition';
  id: string;
  clinicalStatus: FHIRCodeableConcept;
  verificationStatus: FHIRCodeableConcept;
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
};

export type FHIRMedicationRequest = {
  resourceType: 'MedicationRequest';
  id: string;
  status: 'active' | 'completed' | 'stopped';
  intent: 'order';
  medicationCodeableConcept: FHIRCodeableConcept;
  subject: FHIRReference;
  dosageInstruction?: {
    text: string;
    timing?: { repeat: { frequency: number; period: number; periodUnit: string } };
  }[];
  dispenseRequest?: { quantity: { value: number; unit: string } };
};

export type FHIRCarePlan = {
  resourceType: 'CarePlan';
  id: string;
  status: 'active' | 'completed';
  intent: 'plan';
  title: string;
  description: string;
  subject: FHIRReference;
  period?: { start: string; end?: string };
};

export type FHIRBundleEntry = {
  fullUrl: string;
  resource:
    | FHIRPatient
    | FHIREncounter
    | FHIRObservation
    | FHIRCondition
    | FHIRMedicationRequest
    | FHIRCarePlan;
  request: { method: 'PUT' | 'POST'; url: string };
};

export type FHIRTransactionBundle = {
  resourceType: 'Bundle';
  id: string;
  type: 'transaction';
  timestamp: string;
  entry: FHIRBundleEntry[];
};