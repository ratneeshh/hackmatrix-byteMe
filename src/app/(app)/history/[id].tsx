import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../api/supabase';
import { GetSessionResponse } from '../../../../shared/types/api';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'soap' | 'transcript' | 'fhir'>('soap');

  const { data, isLoading } = useQuery<GetSessionResponse>({
    queryKey: ['session', id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(`sessions/${id}`);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const speakerColor = (label: string) =>
    label === 'DOCTOR' ? '#4a9eff' : label === 'PATIENT' ? '#00d4aa' : '#a78bfa';

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0f1e',
        alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00d4aa" size="large" />
      </View>
    );
  }

  const soap = data?.soap_note;
  const fhir = data?.fhir_bundle;
  const transcripts = data?.transcripts ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e' }}>
      <View style={{
        paddingTop: 60, paddingHorizontal: 24,
        paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a2744'
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: '#4a5568', fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800' }}>
          Session Detail
        </Text>
        <Text style={{ color: '#4a5568', fontSize: 13, marginTop: 2 }}>
          {new Date(data?.session.started_at ?? '').toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
        </Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 24,
        paddingVertical: 12, gap: 8 }}>
        {(['soap', 'transcript', 'fhir'] as const).map(tab => (
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
              fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
            }}>
              {tab === 'soap' ? '📋 SOAP' : tab === 'transcript' ? '💬 Chat' : '🏥 FHIR'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingTop: 8 }}
      >
        {/* SOAP Tab */}
        {activeTab === 'soap' && soap && (
          <View>
            {[
              { label: 'Chief Complaint', emoji: '🤒', value: soap.chief_complaint },
              { label: 'History', emoji: '📖', value: soap.history },
              { label: 'Examination', emoji: '🔍', value: soap.examination },
              { label: 'Assessment', emoji: '🧠', value: soap.assessment },
              { label: 'Plan', emoji: '📝', value: soap.plan },
            ].map((section, i) => (
              <View key={i} style={{
                backgroundColor: '#111827', borderRadius: 16,
                padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: '#1a2744',
              }}>
                <Text style={{ color: '#8892a4', fontSize: 11, fontWeight: '700',
                  letterSpacing: 1, marginBottom: 8 }}>
                  {section.emoji} {section.label.toUpperCase()}
                </Text>
                <Text style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 22 }}>
                  {section.value || '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <View>
            {transcripts.length === 0 ? (
              <Text style={{ color: '#4a5568', textAlign: 'center',
                paddingVertical: 40, fontSize: 14 }}>
                No transcript available
              </Text>
            ) : (
              transcripts.map((chunk, i) => (
                <View key={chunk.id} style={{ marginBottom: 14 }}>
                  <Text style={{
                    color: speakerColor(chunk.speaker_label),
                    fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4,
                  }}>
                    [{chunk.speaker_label}]
                  </Text>
                  <View style={{
                    backgroundColor: '#111827', borderRadius: 12,
                    padding: 14, borderWidth: 1, borderColor: '#1a2744',
                  }}>
                    <Text style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 22 }}>
                      {chunk.text}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* FHIR Tab */}
        {activeTab === 'fhir' && (
          <View>
            {fhir ? (
              <View>
                <View style={{
                  backgroundColor: '#00d4aa20', borderRadius: 12,
                  padding: 14, marginBottom: 16,
                  borderWidth: 1, borderColor: '#00d4aa40',
                }}>
                  <Text style={{ color: '#00d4aa', fontSize: 14, fontWeight: '700' }}>
                    ✅ FHIR R4 Bundle
                  </Text>
                  <Text style={{ color: '#4a9eff', fontSize: 12, marginTop: 4 }}>
                    {fhir.resource_types?.join(' · ')}
                  </Text>
                </View>
                <Text style={{
                  color: '#4a9eff', fontSize: 12,
                  fontFamily: 'monospace', lineHeight: 18,
                }}>
                  {JSON.stringify(fhir.bundle, null, 2)}
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#4a5568', textAlign: 'center',
                paddingVertical: 40, fontSize: 14 }}>
                No FHIR bundle available
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}