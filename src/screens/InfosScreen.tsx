import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { GlassCard } from '../components/GlassCard';
import { supabase } from '../lib/supabase';
import { AppNotification } from '../types';

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function InfosScreen() {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setNotifications((data ?? []) as AppNotification[]);
        setLoading(false);
      });
  }, []);

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: 'transparent' }]}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
        <Text style={styles.headerSub}>PK Fußballschule</Text>
        <Text style={styles.headerTitle}>Infos &{'\n'}Neuigkeiten</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={C.accentLight} style={{ marginTop: 40 }} />
        ) : notifications.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📢</Text>
            <Text style={styles.emptyTitle}>Keine Infos vorhanden</Text>
            <Text style={styles.emptySub}>Hier erscheinen Neuigkeiten und Infos zu deinem Standort.</Text>
          </GlassCard>
        ) : (
          notifications.map(n => (
            <GlassCard key={n.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>{fmtDate(n.created_at)}</Text>
                {n.location && (
                  <View style={styles.locationBadge}>
                    <Text style={styles.locationText}>📍 {n.location}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardTitle}>{n.title}</Text>
              <Text style={styles.cardBody}>{n.body}</Text>
            </GlassCard>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textFaint,
    letterSpacing: 0.12,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  content: { paddingHorizontal: 20 },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 14, color: C.textFaint, textAlign: 'center', lineHeight: 20 },
  card: {
    padding: 20,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardDate: { fontSize: 12, fontWeight: '600', color: C.textFaint },
  locationBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  locationText: { fontSize: 12, fontWeight: '600', color: C.textGlass },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 8 },
  cardBody: { fontSize: 14, color: C.textGlass, lineHeight: 21 },
});
