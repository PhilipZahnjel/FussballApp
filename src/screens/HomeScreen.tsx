import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { GlassCard } from '../components/GlassCard';
import { Btn } from '../components/Btn';
import { Appointment, Tab } from '../types';
import { todayStr, fmtDate } from '../constants/i18n';
import { useProfile } from '../hooks/useProfile';
import { useMeasurements } from '../hooks/useMeasurements';

interface Props {
  appointments: Appointment[];
  setTab: (t: Tab) => void;
}

export function HomeScreen({ appointments, setTab }: Props) {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const { latest } = useMeasurements();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const ts = todayStr();
  const next = [...appointments]
    .filter(a => a.date >= ts && a.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
      backgroundColor="transparent"
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
          <Text style={styles.headerSub}>Muster EMS Studio · Musterstadt</Text>
          <Text style={styles.headerTitle}>Guten Tag,{'\n'}{firstName}!</Text>
        </View>

        {/* Nächster Termin */}
        <View style={styles.section}>
          {next ? (
            <GlassCard style={styles.nextCard}>
              <Text style={styles.nextLabel}>Nächster Termin</Text>
              <Text style={styles.nextTitle}>EMS Training</Text>
              <Text style={styles.nextDate}>{fmtDate(next.date)}</Text>
              <View style={styles.nextMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>🕐</Text>
                  <Text style={styles.metaText}>{next.time} Uhr</Text>
                </View>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyTitle}>Kein bevorstehender Termin</Text>
              <Text style={styles.emptySub}>Buche jetzt deinen nächsten EMS-Termin</Text>
            </GlassCard>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.btns}>
          <Btn label="Termin buchen" onPress={() => setTab('buchen')} variant="primary" />
          <View style={{ height: 12 }} />
          <Btn label="Meine Termine anzeigen" onPress={() => setTab('termine')} variant="ghost" />
        </View>

        {/* Letzte Messung */}
        {latest && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionLabel}>Letzte Messung</Text>
            <GlassCard style={styles.measureCard}>
              <View style={styles.measureGrid}>
                {[
                  ['Gewicht', latest.weight !== null ? `${latest.weight} kg` : '—'],
                  ['Körperfett', latest.body_fat !== null ? `${latest.body_fat} %` : '—'],
                  ['Muskelmasse', latest.muscle_mass !== null ? `${latest.muscle_mass} kg` : '—'],
                  ['Grundumsatz', latest.bmr !== null ? `${latest.bmr} kcal` : '—'],
                ].map(([k, v]) => (
                  <View key={k} style={styles.measureItem}>
                    <Text style={styles.measureVal}>{v}</Text>
                    <Text style={styles.measureKey}>{k}</Text>
                  </View>
                ))}
              </View>
              <Btn label="Alle Messwerte" onPress={() => setTab('messungen')} variant="ghost" style={{ marginTop: 16 }} />
            </GlassCard>
          </View>
        )}
      </Animated.View>
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
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  nextCard: {
    padding: 22,
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.14,
    marginBottom: 12,
  },
  nextTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  nextDate: {
    fontSize: 16,
    color: C.textGlass,
    marginBottom: 12,
  },
  nextMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 15,
    color: C.textGlass,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: C.textFaint,
    textAlign: 'center',
  },
  btns: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.12,
    marginBottom: 12,
  },
  measureCard: { padding: 20 },
  measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  measureItem: { width: '45%' },
  measureVal: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 2 },
  measureKey: { fontSize: 12, color: C.textFaint, fontWeight: '600' },
});
