import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { Card } from '../components/Card';
import { useMeasurements } from '../hooks/useMeasurements';
import { Measurement } from '../types';

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Kaum Bewegung', factor: 1.2 },
  { id: 'light', label: 'Leicht aktiv', factor: 1.375 },
  { id: 'moderate', label: 'Mäßig aktiv', factor: 1.55 },
  { id: 'active', label: 'Sehr aktiv', factor: 1.725 },
  { id: 'extreme', label: 'Extrem aktiv', factor: 1.9 },
];

function fmt(val: number | null, unit: string): string {
  if (val === null || val === undefined) return '—';
  return `${val} ${unit}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function SectionCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {rows.map(([k, v], i) => (
        <View key={k} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <Text style={styles.rowKey}>{k}</Text>
          <Text style={styles.rowVal}>{v}</Text>
        </View>
      ))}
    </Card>
  );
}

function MeasurementDetail({ m, activityId, setActivityId }: {
  m: Measurement;
  activityId: string;
  setActivityId: (id: string) => void;
}) {
  const activity = ACTIVITY_LEVELS.find(a => a.id === activityId)!;
  const gesamtumsatz = m.bmr ? Math.round(m.bmr * activity.factor) : null;
  const aktivumsatz = m.bmr && gesamtumsatz ? gesamtumsatz - m.bmr : null;

  return (
    <>
      <SectionCard title="Körperwerte" rows={[
        ['Gewicht', fmt(m.weight, 'kg')],
        ['Größe', fmt(m.height, 'cm')],
        ['Ruhepuls', fmt(m.resting_pulse, 'bpm')],
        ['Blutdruck systolisch', fmt(m.blood_pressure_sys, 'mmHg')],
        ['Blutdruck diastolisch', fmt(m.blood_pressure_dia, 'mmHg')],
      ]} />

      <SectionCard title="Körperanteile" rows={[
        ['Körperfett', fmt(m.body_fat, '%')],
        ['Körperwasser', fmt(m.body_water, '%')],
        ['Fettfreie Masse', fmt(m.fat_free_mass, 'kg')],
        ['Viszeralfett', m.visceral_fat !== null ? `Level ${m.visceral_fat}` : '—'],
        ['Muskelmasse', fmt(m.muscle_mass, 'kg')],
        ['Knochenmasse', fmt(m.bone_mass, 'kg')],
      ]} />

      <SectionCard title="Umfang" rows={[
        ['Brust', fmt(m.circumference_chest, 'cm')],
        ['Hüfte', fmt(m.circumference_hip, 'cm')],
        ['Taille', fmt(m.circumference_waist, 'cm')],
        ['Arm links', fmt(m.circumference_arm_left, 'cm')],
        ['Arm rechts', fmt(m.circumference_arm_right, 'cm')],
        ['Bein links', fmt(m.circumference_leg_left, 'cm')],
        ['Bein rechts', fmt(m.circumference_leg_right, 'cm')],
      ]} />

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Umsatz & Kalorienrechner</Text>
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.rowKey}>Grundumsatz</Text>
          <Text style={styles.rowVal}>{fmt(m.bmr, 'kcal')}</Text>
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.rowKey}>Ruheumsatz</Text>
          <Text style={styles.rowVal}>{fmt(m.rmr, 'kcal')}</Text>
        </View>

        <View style={styles.calcSection}>
          <Text style={styles.calcLabel}>Aktivitätsstufe wählen</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_LEVELS.map(a => (
              <TouchableOpacity
                key={a.id}
                onPress={() => setActivityId(a.id)}
                activeOpacity={0.8}
                style={[styles.activityBtn, activityId === a.id && styles.activityBtnActive]}
              >
                <Text style={[styles.activityBtnLabel, activityId === a.id && styles.activityBtnLabelActive]}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.rowKey}>Aktivumsatz</Text>
          <Text style={styles.rowVal}>{aktivumsatz !== null ? `${aktivumsatz} kcal` : '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowKey, { color: C.accent, fontWeight: '700' }]}>Gesamtumsatz</Text>
          <Text style={[styles.rowVal, { color: C.accent, fontSize: 17 }]}>
            {gesamtumsatz !== null ? `${gesamtumsatz} kcal` : '—'}
          </Text>
        </View>
      </Card>
    </>
  );
}

export function MessungenScreen() {
  const insets = useSafeAreaInsets();
  const { measurements, latest, loading } = useMeasurements();
  const [selected, setSelected] = useState<Measurement | null>(null);
  const [activityId, setActivityId] = useState('moderate');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (latest && !selected) setSelected(latest);
  }, [latest]);

  const current = selected ?? latest;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 24 }]}
      showsVerticalScrollIndicator={false}
      backgroundColor="transparent"
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text style={styles.screenTitle}>Messungen</Text>

        {loading ? (
          <Text style={styles.empty}>Wird geladen…</Text>
        ) : !current ? (
          <Text style={styles.empty}>Noch keine Messungen vorhanden.{'\n'}Das Studio trägt deine Messwerte ein.</Text>
        ) : (
          <>
            {/* Date picker */}
            {measurements.length > 1 && (
              <View style={styles.datePicker}>
                <Text style={styles.datePickerLabel}>Messung vom</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                  {measurements.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setSelected(m)}
                      activeOpacity={0.8}
                      style={[styles.dateChip, current.id === m.id && styles.dateChipActive]}
                    >
                      <Text style={[styles.dateChipText, current.id === m.id && styles.dateChipTextActive]}>
                        {fmtDate(m.measured_at)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {measurements.length === 1 && (
              <Text style={styles.dateLabel}>Messung vom {fmtDate(current.measured_at)}</Text>
            )}

            <MeasurementDetail m={current} activityId={activityId} setActivityId={setActivityId} />
          </>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.4, marginBottom: 20 },
  empty: { textAlign: 'center', color: C.textFaint, fontSize: 15, paddingTop: 40, lineHeight: 24 },
  datePicker: { marginBottom: 20 },
  datePickerLabel: { fontSize: 12, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.1, marginBottom: 10 },
  dateScroll: { flexDirection: 'row' },
  dateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 8 },
  dateChipActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  dateChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  dateChipTextActive: { color: C.accent },
  dateLabel: { fontSize: 14, color: C.textFaint, marginBottom: 16 },
  sectionCard: { marginBottom: 14 },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.textMid, textTransform: 'uppercase', letterSpacing: 0.1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  rowKey: { fontSize: 15, color: C.textMid },
  rowVal: { fontSize: 15, fontWeight: '700', color: C.text },
  calcSection: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  calcLabel: { fontSize: 13, fontWeight: '600', color: C.textMid, marginBottom: 10 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.05)' },
  activityBtnActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  activityBtnLabel: { fontSize: 12, fontWeight: '600', color: C.textMid },
  activityBtnLabelActive: { color: C.accent },
});
