import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../../../store/sessionStore';
import { supabase } from '../../../api/supabase';
import { Medication, ICD10Code } from '../../../../shared/types/db';

export default function ReviewScreen() {
  const router = useRouter();
  const { soapNote, fhirBundle, pdfUrl, sessionId, setSoapNote, setStatus } = useSessionStore();

  const [activeTab, setActiveTab] = useState<'soap' | 'fhir' | 'pdf'>('soap');
  const [editing, setEditing] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [finalising, setFinalising] = useState(false);

  if (!soapNote) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0f1e', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00d4aa" size="large" />
        <Text style={{ color: '#4a5568', marginTop: 16, fontSize: 15 }}>
          Loading SOAP note...
        </Text>
      </View>
    );
  }

  const getValue = (field: string, fallback: string) =>
    edits[field] !== undefined ? edits[field] : fallback;

  const handleEdit = (field: string, value: string) => {
    setEdits(prev => ({ ...prev, [field]: value }));
  };

  const handleFinalise = async () => {
    setFinalising(true);
    try {
      await supabase.functions.invoke(`sessions/${sessionId}/soap`, {
        body: { doctor_edits: edits },
      });
      const { data, error } = await supabase.functions.invoke(
        `sessions/${sessionId}/finalise`, { body: {} }
      );
      if (error) throw error;
      setStatus('COMPLETE');
      Alert.alert(
        '✅ Session Complete!',
        'SOAP note finalised. Prescription PDF is ready.',
        [{ text: 'View History', onPress: () => router.replace('/(app)/history/') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to finalise session');
    } finally {
      setFinalising(false);
    }
  };

  const tabs = ['soap', 'fhir', 'pdf'] as const;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <View style={{
        paddingTop: 60, paddingHorizontal: 24,
        paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a2744'
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: '#4a5568', fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800' }}>
          Review & Finalise
        </Text>
        <Text style={{ color: '#4a5568', fontSize: 13, marginTop: 2 }}>
          Review AI-generated notes before finalising
        </Text>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: 24,
        paddingVertical: 12, gap: 8,
      }}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10,
              alignItems: 'center',
              backgroundColor: activeTab === tab ? '#00d4aa20' : '#111827',
              borderWidth: 1,
              borderColor: activeTab === tab ? '#00d4aa' : '#1a2744',
            }}
          >
            <Text style={{
              color: activeTab === tab ? '#00d4aa' : '#4a5568',
              fontSize: 13, fontWeight: '700',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {tab === 'soap' ? '📋 SOAP' : tab === 'fhir' ? '🏥 FHIR' : '📄 PDF'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingTop: 8 }}
      >
        {/* SOAP Tab */}
        {activeTab === 'soap' && (
          <View>
            <SOAPSection
              title="Chief Complaint"
              emoji="🤒"
              field="chief_complaint"
              value={getValue('chief_complaint', soapNote.chief_complaint)}
              editing={editing === 'chief_complaint'}
              onEdit={() => setEditing('chief_complaint')}
              onDone={() => setEditing(null)}
              onChange={v => handleEdit('chief_complaint', v)}
            />
            <SOAPSection
              title="History"
              emoji="📖"
              field="history"
              value={getValue('history', soapNote.history)}
              editing={editing === 'history'}
              onEdit={() => setEditing('history')}
              onDone={() => setEditing(null)}
              onChange={v => handleEdit('history', v)}
              multiline
            />
            <SOAPSection
              title="Examination"
              emoji="🔍"
              field="examination"
              value={getValue('examination', soapNote.examination)}
              editing={editing === 'examination'}
              onEdit={() => setEditing('examination')}
              onDone={() => setEditing(null)}
              onChange={v => handleEdit('examination', v)}
              multiline
            />
            <SOAPSection
              title="Assessment"
              emoji="🧠"
              field="assessment"
              value={getValue('assessment', soapNote.assessment)}
              editing={editing === 'assessment'}
              onEdit={() => setEditing('assessment')}
              onDone={() => setEditing(null)}
              onChange={v => handleEdit('assessment', v)}
              multiline
            />

            {/* ICD-10 Codes */}
            {soapNote.icd10_codes?.length > 0 && (
              <View style={{
                backgroundColor: '#111827', borderRadius: 16,
                padding: 16, marginBottom: 16,
                borderWidth: 1, borderColor: '#1a2744',
              }}>
                <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '700',
                  letterSpacing: 1, marginBottom: 12 }}>
                  🏷️ ICD-10 CODES
                </Text>
                {soapNote.icd10_codes.map((code: ICD10Code, i: number) => (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 6, gap: 10,
                  }}>
                    <View style={{
                      backgroundColor: '#4a9eff20', borderRadius: 6,
                      paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{ color: '#4a9eff', fontSize: 12, fontWeight: '700' }}>
                        {code.code}
                      </Text>
                    </View>
                    <Text style={{ color: '#e2e8f0', fontSize: 14, flex: 1 }}>
                      {code.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <SOAPSection
              title="Plan"
              emoji="📝"
              field="plan"
              value={getValue('plan', soapNote.plan)}
              editing={editing === 'plan'}
              onEdit={() => setEditing('plan')}
              onDone={() => setEditing(null)}
              onChange={v => handleEdit('plan', v)}
              multiline
            />

            {/* Medications */}
            {soapNote.medications?.length > 0 && (
              <View style={{
                backgroundColor: '#111827', borderRadius: 16,
                padding: 16, marginBottom: 16,
                borderWidth: 1, borderColor: '#1a2744',
              }}>
                <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '700',
                  letterSpacing: 1, marginBottom: 12 }}>
                  💊 MEDICATIONS
                </Text>
                {soapNote.medications.map((med: Medication, i: number) => (
                  <View key={i} style={{
                    backgroundColor: '#0a0f1e', borderRadius: 12,
                    padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: '#1a2744',
                  }}>
                    <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700',
                      marginBottom: 4 }}>
                      {med.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <MedBadge label={med.dosage} color="#00d4aa" />
                      <MedBadge label={med.frequency} color="#4a9eff" />
                      <MedBadge label={med.duration} color="#a78bfa" />
                    </View>
                    {med.notes && (
                      <Text style={{ color: '#4a5568', fontSize: 12, marginTop: 6 }}>
                        {med.notes}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Vitals */}
            {soapNote.vitals && Object.keys(soapNote.vitals).length > 0 && (
              <View style={{
                backgroundColor: '#111827', borderRadius: 16,
                padding: 16, marginBottom: 16,
                borderWidth: 1, borderColor: '#1a2744',
              }}>
                <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '700',
                  letterSpacing: 1, marginBottom: 12 }}>
                  📊 VITALS
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(soapNote.vitals).map(([key, val]) =>
                    val ? (
                      <View key={key} style={{
                        backgroundColor: '#0a0f1e', borderRadius: 10,
                        padding: 10, minWidth: 80, alignItems: 'center',
                        borderWidth: 1, borderColor: '#1a2744',
                      }}>
                        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                          {String(val)}
                        </Text>
                        <Text style={{ color: '#4a5568', fontSize: 11, marginTop: 2 }}>
                          {key.toUpperCase()}
                        </Text>
                      </View>
                    ) : null
                  )}
                </View>
              </View>
            )}

            {soapNote.follow_up_days && (
              <View style={{
                backgroundColor: '#a78bfa20', borderRadius: 12,
                padding: 14, marginBottom: 16,
                borderWidth: 1, borderColor: '#a78bfa40',
                flexDirection: 'row', alignItems: 'center', gap: 10,
              }}>
                <Text style={{ fontSize: 20 }}>🗓️</Text>
                <Text style={{ color: '#a78bfa', fontSize: 14, fontWeight: '600' }}>
                  Follow-up in {soapNote.follow_up_days} days
                </Text>
              </View>
            )}
          </View>
        )}

        {/* FHIR Tab */}
        {activeTab === 'fhir' && (
          <View>
            {fhirBundle ? (
              <View>
                <View style={{
                  backgroundColor: '#00d4aa20', borderRadius: 12,
                  padding: 14, marginBottom: 16,
                  borderWidth: 1, borderColor: '#00d4aa40',
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                }}>
                  <Text style={{ fontSize: 20 }}>✅</Text>
                  <View>
                    <Text style={{ color: '#00d4aa', fontSize: 14, fontWeight: '700' }}>
                      FHIR R4 Bundle Ready
                    </Text>
                    <Text style={{ color: '#4a9eff', fontSize: 12, marginTop: 2 }}>
                      {fhirBundle.resource_types?.join(' · ')}
                    </Text>
                  </View>
                </View>
                <FHIRBundleViewer bundle={fhirBundle.bundle} />
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <ActivityIndicator color="#00d4aa" />
                <Text style={{ color: '#4a5568', fontSize: 14, marginTop: 16 }}>
                  Generating FHIR R4 bundle...
                </Text>
              </View>
            )}
          </View>
        )}

        {/* PDF Tab */}
        {activeTab === 'pdf' && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            {pdfUrl ? (
              <>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>📄</Text>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700',
                  marginBottom: 8 }}>
                  Prescription Ready
                </Text>
                <Text style={{ color: '#4a5568', fontSize: 14, marginBottom: 24,
                  textAlign: 'center' }}>
                  Download the prescription PDF to share with patient
                </Text>
                <TouchableOpacity style={{
                  backgroundColor: '#00d4aa', borderRadius: 14,
                  paddingVertical: 14, paddingHorizontal: 32,
                }}>
                  <Text style={{ color: '#0a0f1e', fontSize: 16, fontWeight: '700' }}>
                    📥 Download PDF
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator color="#00d4aa" />
                <Text style={{ color: '#4a5568', fontSize: 14, marginTop: 16 }}>
                  Generating prescription PDF...
                </Text>
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Finalise Button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 24, backgroundColor: '#0a0f1e',
        borderTopWidth: 1, borderTopColor: '#1a2744',
      }}>
        <TouchableOpacity
          onPress={handleFinalise}
          disabled={finalising}
          style={{
            backgroundColor: '#00d4aa', borderRadius: 16,
            paddingVertical: 18, alignItems: 'center',
          }}
        >
          {finalising ? (
            <ActivityIndicator color="#0a0f1e" />
          ) : (
            <Text style={{ color: '#0a0f1e', fontSize: 17, fontWeight: '800' }}>
              ✅ Finalise & Save
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// SOAP Section Component
function SOAPSection({ title, emoji, field, value, editing, onEdit, onDone, onChange, multiline = false }: {
  title: string; emoji: string; field: string; value: string;
  editing: boolean; onEdit: () => void; onDone: () => void;
  onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <View style={{
      backgroundColor: '#111827', borderRadius: 16,
      padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: editing ? '#00d4aa' : '#1a2744',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
          {emoji} {title.toUpperCase()}
        </Text>
        <TouchableOpacity onPress={editing ? onDone : onEdit}>
          <Text style={{ color: editing ? '#00d4aa' : '#4a9eff', fontSize: 13, fontWeight: '600' }}>
            {editing ? 'Done' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>
      {editing ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          autoFocus
          style={{
            color: '#ffffff', fontSize: 15, lineHeight: 22,
            minHeight: multiline ? 80 : undefined,
          }}
        />
      ) : (
        <Text style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 22 }}>
          {value || <Text style={{ color: '#4a5568' }}>Not recorded</Text>}
        </Text>
      )}
    </View>
  );
}

// Medication Badge
function MedBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{
      backgroundColor: `${color}20`, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
    }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// FHIR Bundle Viewer
function FHIRBundleViewer({ bundle }: { bundle: Record<string, any> }) {
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (id: string) =>
    setExpanded(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : [...prev, id]);

  if (!bundle?.entry) {
    return (
      <Text style={{ color: '#4a5568', textAlign: 'center', paddingVertical: 20 }}>
        No FHIR resources found
      </Text>
    );
  }

  const resourceColors: Record<string, string> = {
    Patient: '#4a9eff',
    Encounter: '#00d4aa',
    Observation: '#f59e0b',
    Condition: '#ff4444',
    MedicationRequest: '#a78bfa',
    CarePlan: '#10b981',
  };

  return (
    <View>
      <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '700',
        letterSpacing: 1, marginBottom: 12 }}>
        FHIR R4 RESOURCES ({bundle.entry?.length ?? 0})
      </Text>
      {bundle.entry?.map((entry: any, i: number) => {
        const resource = entry.resource;
        const type = resource?.resourceType ?? 'Unknown';
        const id = resource?.id ?? String(i);
        const isOpen = expanded.includes(id);
        const color = resourceColors[type] ?? '#8892a4';

        return (
          <TouchableOpacity
            key={id}
            onPress={() => toggle(id)}
            style={{
              backgroundColor: '#0a0f1e', borderRadius: 12,
              marginBottom: 8, overflow: 'hidden',
              borderWidth: 1, borderColor: isOpen ? color : '#1a2744',
            }}
          >
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              padding: 14, gap: 10,
            }}>
              <View style={{
                backgroundColor: `${color}20`, borderRadius: 6,
                paddingHorizontal: 8, paddingVertical: 3,
              }}>
                <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{type}</Text>
              </View>
              <Text style={{ color: '#8892a4', fontSize: 12, flex: 1 }}>
                {id.substring(0, 16)}...
              </Text>
              <Text style={{ color: '#4a5568', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</Text>
            </View>
            {isOpen && (
              <View style={{
                padding: 14, paddingTop: 0,
                borderTopWidth: 1, borderTopColor: '#1a2744',
              }}>
                <Text style={{
                  color: '#4a9eff', fontSize: 12,
                  fontFamily: 'monospace', lineHeight: 18,
                }}>
                  {JSON.stringify(resource, null, 2)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}