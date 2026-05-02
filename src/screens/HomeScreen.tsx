import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { GlassCard } from '../components/GlassCard';
import { Btn } from '../components/Btn';
import { Appointment, Tab, CancellationToken } from '../types';
import { todayStr, fmtDate } from '../constants/i18n';
import { Profile } from '../hooks/useProfile';
import { PROGRAMS, PROGRAM_CATEGORY, ProgramId } from '../constants/programs';

interface Props {
  appointments: Appointment[];
  profile: Profile | null;
  activeTokens: CancellationToken[];
  setTab: (t: Tab) => void;
}

function daysUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function HomeScreen({ appointments, profile, activeTokens, setTab }: Props) {
  const insets = useSafeAreaInsets();
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
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

  // Kontingent-Check: Button aktiv wenn Token vorhanden oder Restkontingent > 0
  const thisMonth = ts.slice(0, 7);
  const usedIndividual = appointments.filter(
    a => a.status === 'confirmed' && a.date.startsWith(thisMonth) && PROGRAM_CATEGORY[a.program as ProgramId] === 'individual'
  ).length;
  const usedGruppe = appointments.filter(
    a => a.status === 'confirmed' && a.date.startsWith(thisMonth) && PROGRAM_CATEGORY[a.program as ProgramId] === 'gruppe'
  ).length;
  const hasTokens = activeTokens.length > 0;
  const hasQuota =
    (profile?.quota_individual ?? 0) > usedIndividual ||
    (profile?.quota_gruppe ?? 0) > usedGruppe;
  const buchenActive = hasTokens || hasQuota;

  // Frühest ablaufender Token
  const earliestToken = activeTokens
    .slice()
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at))[0];
  const tokenDaysLeft = earliestToken ? daysUntil(earliestToken.expires_at) : null;

  const deadlineColor =
    tokenDaysLeft !== null
      ? tokenDaysLeft <= 7 ? '#EF4444'
      : tokenDaysLeft <= 14 ? '#F59E0B'
      : C.accentLight
      : C.accentLight;

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: 'transparent' }]}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
          <Text style={styles.headerSub}>PK Fußballschule</Text>
          <Text style={styles.headerTitle}>Guten Tag,{'\n'}{firstName}!</Text>
        </View>

        {/* 4-Wochen-Frist Anzeige */}
        {earliestToken && tokenDaysLeft !== null && (
          <View style={styles.section}>
            <GlassCard style={[styles.deadlineCard, { borderColor: deadlineColor + '55' }]}>
              <View style={styles.deadlineRow}>
                <Text style={styles.deadlineIcon}>
                  {tokenDaysLeft <= 7 ? '🚨' : tokenDaysLeft <= 14 ? '⚠️' : '🎫'}
                </Text>
                <View style={styles.deadlineInfo}>
                  <Text style={styles.deadlineLabel}>Nachholtermin-Frist</Text>
                  <Text style={[styles.deadlineDays, { color: deadlineColor }]}>
                    Noch {tokenDaysLeft} {tokenDaysLeft === 1 ? 'Tag' : 'Tage'}
                  </Text>
                  <Text style={styles.deadlineSub}>
                    Verfällt am {fmtDate(earliestToken.expires_at.slice(0, 10))}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        )}

        {/* Nächster Termin */}
        <View style={styles.section}>
          {next ? (
            <GlassCard style={styles.nextCard}>
              <Text style={styles.nextLabel}>Nächster Termin</Text>
              <Text style={styles.nextTitle}>{PROGRAMS.find(p => p.id === next.program)?.name ?? 'Training'}</Text>
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
              <Text style={styles.emptySub}>Buche jetzt deinen nächsten Nachholtermin</Text>
            </GlassCard>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.btns}>
          <Btn
            label="Nachholtermin buchen"
            onPress={() => setTab('buchen')}
            variant={buchenActive ? 'primary' : 'ghost'}
            style={!buchenActive ? styles.btnDisabled : undefined}
          />
          {!buchenActive && (
            <Text style={styles.noQuotaHint}>Kein Kontingent verfügbar</Text>
          )}
          <View style={{ height: 12 }} />
          <Btn label="Meine Termine anzeigen" onPress={() => setTab('termine')} variant="ghost" />
        </View>
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
    paddingBottom: 16,
  },
  deadlineCard: {
    padding: 18,
    borderWidth: 1.5,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deadlineIcon: { fontSize: 28 },
  deadlineInfo: { flex: 1 },
  deadlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.14,
    marginBottom: 4,
  },
  deadlineDays: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  deadlineSub: {
    fontSize: 13,
    color: C.textFaint,
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
  metaIcon: { fontSize: 14 },
  metaText: { fontSize: 15, color: C.textGlass },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 4, textAlign: 'center' },
  emptySub: { fontSize: 14, color: C.textFaint, textAlign: 'center' },
  btns: { paddingHorizontal: 20 },
  btnDisabled: { opacity: 0.45 },
  noQuotaHint: {
    fontSize: 12,
    color: C.textFaint,
    textAlign: 'center',
    marginTop: 8,
  },
});
