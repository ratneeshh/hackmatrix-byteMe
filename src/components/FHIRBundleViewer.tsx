import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { resourceColor, formatResource } from '../utils/fhirUtils';

interface FHIRBundleViewerProps {
  bundle: Record<string, any>;
}

export function FHIRBundleViewer({ bundle }: FHIRBundleViewerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!bundle?.entry?.length) {
    return (
      <Text style={styles.empty}>No FHIR resources found</Text>
    );
  }

  const entries: any[] = bundle.entry;

  return (
    <View>
      <Text style={styles.title}>
        FHIR R4 RESOURCES ({entries.length})
      </Text>
      {entries.map((entry, i) => {
        const resource = entry.resource;
        const type     = resource?.resourceType ?? 'Unknown';
        const id       = resource?.id ?? String(i);
        const color    = resourceColor(type);
        const isOpen   = expanded.has(id);
        let subtitle   = '';
        try { subtitle = formatResource(resource); } catch {}

        return (
          <TouchableOpacity
            key={id}
            onPress={() => toggle(id)}
            activeOpacity={0.8}
            style={[styles.card, { borderColor: isOpen ? color : '#1a2744' }]}
          >
            {/* Row header */}
            <View style={styles.row}>
              <View style={[styles.typeBadge, { backgroundColor: `${color}20` }]}>
                <Text style={[styles.typeText, { color }]}>{type}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                ) : null}
                <Text style={styles.idText}>{id.substring(0, 20)}{id.length > 20 ? '...' : ''}</Text>
              </View>
              <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
            </View>

            {/* Expanded JSON */}
            {isOpen && (
              <View style={styles.json}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.jsonText}>
                    {JSON.stringify(resource, null, 2)}
                  </Text>
                </ScrollView>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#8892a4', fontSize: 12, fontWeight: '700',
    letterSpacing: 1, marginBottom: 12,
  },
  card: {
    backgroundColor: '#0a0f1e', borderRadius: 12,
    marginBottom: 8, borderWidth: 1, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14,
  },
  typeBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  typeText: { fontSize: 12, fontWeight: '700' },
  subtitle: { color: '#e2e8f0', fontSize: 13, marginBottom: 2 },
  idText:   { color: '#4a5568', fontSize: 11 },
  chevron:  { color: '#4a5568', fontSize: 13 },
  json: {
    paddingHorizontal: 14, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: '#1a2744',
  },
  jsonText: {
    color: '#4a9eff', fontSize: 11,
    fontFamily: 'monospace', lineHeight: 17,
  },
  empty: {
    color: '#4a5568', textAlign: 'center',
    paddingVertical: 20, fontSize: 14,
  },
});