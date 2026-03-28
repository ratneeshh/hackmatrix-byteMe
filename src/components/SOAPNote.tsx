import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SOAPNote as SOAPNoteType, ICD10Code, Medication } from '../../shared/types/db';
import { MedicationCard } from './MedicationCard';

interface SOAPNoteProps {
  note: SOAPNoteType;
  /** Callback with the delta of changed fields when doctor taps Done on any field */
  onEdit?: (field: string, value: string) => void;
  readOnly?: boolean;
}

export function SOAPNote({ note, onEdit, readOnly = false }: SOAPNoteProps) {
  const [editing, setEditing]   = useState<string | null>(null);
  const [localEdits, setLocal]  = useState<Record<string, string>>({});

  const getValue = (field: string, fallback: string) =>
    localEdits[field] !== undefined ? localEdits[field] : fallback;

  const handleChange = (field: string, value: string) => {
    setLocal(prev => ({ ...prev, [field]: value }));
  };

  const handleDone = (field: string) => {
    setEditing(null);
    if (localEdits[field] !== undefined && onEdit) {
      onEdit(field, localEdits[field]);
    }
  };

  return (
    <View>
      <SOAPSection
        title="Chief Complaint" emoji="🤒" field="chief_complaint"
        value={getValue('chief_complaint', note.chief_complaint)}
        editing={!readOnly && editing === 'chief_complaint'}
        onEdit={() => setEditing('chief_complaint')}
        onDone={() => handleDone('chief_complaint')}
        onChange={v => handleChange('chief_complaint', v)}
        readOnly={readOnly}
      />
      <SOAPSection
        title="History" emoji="📖" field="history"
        value={getValue('history', note.history)}
        editing={!readOnly && editing === 'history'}
        onEdit={() => setEditing('history')}
        onDone={() => handleDone('history')}
        onChange={v => handleChange('history', v)}
        multiline readOnly={readOnly}
      />
      <SOAPSection
        title="Examination" emoji="🔍" field="examination"
        value={getValue('examination', note.examination)}
        editing={!readOnly && editing === 'examination'}
        onEdit={() => setEditing('examination')}
        onDone={() => handleDone('examination')}
        onChange={v => handleChange('examination', v)}
        multiline readOnly={readOnly}
      />
      <SOAPSection
        title="Assessment" emoji="🧠" field="assessment"
        value={getValue('assessment', note.assessment)}
        editing={!readOnly && editing === 'assessment'}
        onEdit={() => setEditing('assessment')}
        onDone={() => handleDone('assessment')}
        onChange={v => handleChange('assessment', v)}
        multiline readOnly={readOnly}
      />

      {/* ICD-10 codes */}
      {note.icd10_codes?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>🏷️ ICD-10 CODES</Text>
          {note.icd10_codes.map((code: ICD10Code, i: number) => (
            <View key={i} style={styles.icdRow}>
              <View style={styles.icdBadge}>
                <Text style={styles.icdCode}>{code.code}</Text>
              </View>
              <Text style={styles.icdDesc}>{code.description}</Text>
            </View>
          ))}
        </View>
      )}

      <SOAPSection
        title="Plan" emoji="📝" field="plan"
        value={getValue('plan', note.plan)}
        editing={!readOnly && editing === 'plan'}
        onEdit={() => setEditing('plan')}
        onDone={() => handleDone('plan')}
        onChange={v => handleChange('plan', v)}
        multiline readOnly={readOnly}
      />

      {/* Medications */}
      {note.medications?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>💊 MEDICATIONS</Text>
          {note.medications.map((med: Medication, i: number) => (
            <MedicationCard key={i} medication={med} index={i} />
          ))}
        </View>
      )}

      {/* Vitals */}
      {note.vitals && Object.keys(note.vitals).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>📊 VITALS</Text>
          <View style={styles.vitalsGrid}>
            {Object.entries(note.vitals).map(([key, val]) =>
              val ? (
                <View key={key} style={styles.vitalCard}>
                  <Text style={styles.vitalValue}>{String(val)}</Text>
                  <Text style={styles.vitalKey}>{key.toUpperCase()}</Text>
                </View>
              ) : null
            )}
          </View>
        </View>
      )}

      {/* Follow-up */}
      {note.follow_up_days ? (
        <View style={styles.followUp}>
          <Text style={{ fontSize: 20 }}>🗓️</Text>
          <Text style={styles.followUpText}>
            Follow-up in {note.follow_up_days} days
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Section sub-component ────────────────────────────────────────────────────

function SOAPSection({
  title, emoji, field, value,
  editing, onEdit, onDone, onChange,
  multiline = false, readOnly = false,
}: {
  title: string; emoji: string; field: string; value: string;
  editing: boolean; onEdit: () => void; onDone: () => void;
  onChange: (v: string) => void;
  multiline?: boolean; readOnly?: boolean;
}) {
  return (
    <View style={[styles.section, editing ? styles.sectionActive : null]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>
          {emoji} {title.toUpperCase()}
        </Text>
        {!readOnly && (
          <TouchableOpacity onPress={editing ? onDone : onEdit}>
            <Text style={{ color: editing ? '#00d4aa' : '#4a9eff', fontSize: 13, fontWeight: '600' }}>
              {editing ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {editing ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          autoFocus
          style={styles.textInput}
        />
      ) : (
        <Text style={styles.sectionText}>
          {value || <Text style={{ color: '#4a5568' }}>Not recorded</Text>}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#111827', borderRadius: 16,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#1a2744',
  },
  sectionActive: { borderColor: '#00d4aa' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  sectionLabel: {
    color: '#8892a4', fontSize: 12, fontWeight: '700', letterSpacing: 1,
  },
  sectionText: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  textInput: {
    color: '#ffffff', fontSize: 15, lineHeight: 22, minHeight: 60,
  },
  icdRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, gap: 10,
  },
  icdBadge: {
    backgroundColor: '#4a9eff20', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  icdCode: { color: '#4a9eff', fontSize: 12, fontWeight: '700' },
  icdDesc: { color: '#e2e8f0', fontSize: 14, flex: 1 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalCard: {
    backgroundColor: '#0a0f1e', borderRadius: 10,
    padding: 10, minWidth: 80, alignItems: 'center',
    borderWidth: 1, borderColor: '#1a2744',
  },
  vitalValue: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  vitalKey:   { color: '#4a5568', fontSize: 11, marginTop: 2 },
  followUp: {
    backgroundColor: '#a78bfa20', borderRadius: 12,
    padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#a78bfa40',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  followUpText: { color: '#a78bfa', fontSize: 14, fontWeight: '600' },
});