/**
 * fhirUtils.ts
 * Display helpers for FHIR R4 resources.
 * Used by FHIRBundleViewer component and history/[id].tsx.
 */

import type {
  FHIRTransactionBundle,
  FHIRBundleEntry,
  FHIRPatient,
  FHIREncounter,
  FHIRObservation,
  FHIRCondition,
  FHIRMedicationRequest,
  FHIRCarePlan,
  FHIRResourceType,
} from '../../shared/types/fhir';

// ─────────────────────────────────────────────────────────────────────────────
// LOINC code → human-readable vital name
// ─────────────────────────────────────────────────────────────────────────────

const LOINC_LABELS: Record<string, string> = {
  '55284-4': 'Blood Pressure',
  '8480-6':  'Systolic BP',
  '8462-4':  'Diastolic BP',
  '8867-4':  'Heart Rate',
  '8310-5':  'Body Temperature',
  '59408-5': 'SpO2',
  '29463-7': 'Body Weight',
  '8302-2':  'Body Height',
  '39156-5': 'BMI',
};

export function loincToLabel(code: string): string {
  return LOINC_LABELS[code] ?? code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource type → UI colour (matches FHIRBundleViewer in review.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export const FHIR_RESOURCE_COLORS: Record<string, string> = {
  Patient:           '#4a9eff',
  Encounter:         '#00d4aa',
  Observation:       '#f59e0b',
  Condition:         '#ff4444',
  MedicationRequest: '#a78bfa',
  CarePlan:          '#10b981',
};

export function resourceColor(resourceType: string): string {
  return FHIR_RESOURCE_COLORS[resourceType] ?? '#8892a4';
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle summary helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract all resource types present in a bundle. */
export function bundleResourceTypes(bundle: FHIRTransactionBundle): FHIRResourceType[] {
  if (!bundle?.entry) return [];
  const types = bundle.entry.map((e) => e.resource?.resourceType as FHIRResourceType);
  return [...new Set(types)].filter(Boolean);
}

/** Count entries by resource type. */
export function resourceCounts(bundle: FHIRTransactionBundle): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of bundle?.entry ?? []) {
    const type = entry.resource?.resourceType ?? 'Unknown';
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/** Get all entries of a specific resource type. */
export function getResourcesByType<T>(
  bundle: FHIRTransactionBundle,
  type: FHIRResourceType
): T[] {
  return (bundle?.entry ?? [])
    .filter((e) => e.resource?.resourceType === type)
    .map((e) => e.resource as unknown as T);
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource display formatters
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable one-liner for a FHIR Patient resource. */
export function formatPatient(patient: FHIRPatient): string {
  const name = patient.name?.[0];
  const fullName = name
    ? `${(name.given ?? []).join(' ')} ${name.family ?? ''}`.trim()
    : 'Unknown';
  return `${fullName} · ${patient.gender ?? '?'}`;
}

/** Human-readable one-liner for a FHIR Encounter resource. */
export function formatEncounter(encounter: FHIREncounter): string {
  const start = encounter.period?.start
    ? new Date(encounter.period.start).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '?';
  return `Ambulatory visit · ${start}`;
}

/** Human-readable label for a FHIR Observation (vital). */
export function formatObservation(obs: FHIRObservation): string {
  const codingCode = obs.code?.coding?.[0]?.code ?? '';
  const label = obs.code?.text ?? loincToLabel(codingCode);
  const value = obs.valueQuantity
    ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit}`
    : obs.valueString ?? '?';
  return `${label}: ${value}`;
}

/** Human-readable label for a FHIR Condition. */
export function formatCondition(condition: FHIRCondition): string {
  return (
    condition.code?.text ??
    condition.code?.coding?.[0]?.display ??
    condition.code?.coding?.[0]?.code ??
    'Unknown condition'
  );
}

/** Human-readable label for a FHIR MedicationRequest. */
export function formatMedication(med: FHIRMedicationRequest): string {
  const name =
    med.medicationCodeableConcept?.text ??
    med.medicationCodeableConcept?.coding?.[0]?.display ??
    'Unknown medication';
  const dosage = med.dosageInstruction?.[0]?.text ?? '';
  return dosage ? `${name} — ${dosage}` : name;
}

/** Human-readable label for a FHIR CarePlan. */
export function formatCarePlan(plan: FHIRCarePlan): string {
  return plan.title ?? plan.description ?? 'Care plan';
}

/**
 * Generic formatter — accepts any FHIR resource and returns a readable string.
 * Used in FHIRBundleViewer to show a subtitle under the resource type chip.
 */
export function formatResource(resource: FHIRBundleEntry['resource']): string {
  switch (resource.resourceType) {
    case 'Patient':           return formatPatient(resource as FHIRPatient);
    case 'Encounter':         return formatEncounter(resource as FHIREncounter);
    case 'Observation':       return formatObservation(resource as FHIRObservation);
    case 'Condition':         return formatCondition(resource as FHIRCondition);
    case 'MedicationRequest': return formatMedication(resource as FHIRMedicationRequest);
    case 'CarePlan':          return formatCarePlan(resource as FHIRCarePlan);
    default:                  return resource.resourceType ?? 'Resource';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helper
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the bundle has all required PS-1 resource types. */
export function isBundleComplete(bundle: FHIRTransactionBundle): boolean {
  const required: FHIRResourceType[] = [
    'Patient', 'Encounter', 'Condition', 'MedicationRequest',
  ];
  const types = bundleResourceTypes(bundle);
  return required.every((r) => types.includes(r));
}