import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { Card } from '../components/Card';
import { Btn } from '../components/Btn';
import { Appointment, Tab } from '../types';
import { todayStr, fmtDate, DE_MONTHS, DE_DAYS_SHORT } from '../constants/i18n';
import { PROGRAMS } from '../constants/programs';
import { exportToCalendar } from '../utils/calendar';

interface Props {
  appointments: Appointment[];
  cancelAppointment: (id: string) => Promise<{ error: any }>;
  setTab: (t: Tab) => void;
}

const PROGRAM_COLORS: Record<string, string> = {
  muscle:     '#4A8FE8',
  lymph:      '#3DBFA0',
  relax:      '#F5A84A',
  metabolism: '#E87676',
};

function canCancelAppt(appt: Appointment): boolean {
  const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
  const deadline = new Date(apptDateTime.getTime() - 24 * 60 * 60 * 1000);
  return new Date() < deadline;
}

function ApptCard({ appt, onCancel }: { appt: Appointment; onCancel: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const ts = todayStr();
  const dimmed = appt.status === 'cancelled' || appt.date < ts;
  const upcoming = appt.status === 'confirmed' && appt.date >= ts;
  const cancellable = upcoming && canCancelAppt(appt);
  const program = PROGRAMS.find(p => p.id === appt.program);
  const programColor = PROGRAM_COLORS[appt.program] ?? C.accent;

  return (
    <Card style={[styles.apptCard, dimmed && { opacity: 0.55 }]}>
      <View style={styles.apptMain}>
        <View style={[styles.colorBar, { backgroundColor: appt.status === 'cancelled' ? '#ccc' : programColor }]} />
        <View style={styles.apptContent}>
          <View style={styles.apptHeader}>
            <Text style={[styles.apptTitle, { color: appt.status === 'cancelled' ? C.textMid : programColor }]}>
              {program?.name ?? 'EMS Training'}
            </Text>
            {appt.status === 'cancelled' && (
              <View style={styles.cancelBadge}>
                <Text style={styles.cancelBadgeText}>Storniert</Text>
              </View>
            )}
          </View>
          <View style={styles.apptMeta}>
            <Text style={styles.apptMetaIcon}>📅</Text>
            <Text style={styles.apptMetaText}>{fmtDate(appt.date)}</Text>
          </View>
          <View style={styles.apptMeta}>
            <Text style={styles.apptMetaIcon}>🕐</Text>
            <Text style={styles.apptMetaText}>{appt.time} Uhr · {program?.duration ?? 20} Min.</Text>
          </View>
        </View>
      </View>

      {upcoming && (
        expanded ? (
          <View style={styles.confirmSection}>
            <Text style={styles.confirmText}>Termin wirklich stornieren?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity onPress={() => onCancel(appt.id)} style={styles.cancelYesBtn} activeOpacity={0.8}>
                <Text style={styles.cancelYesLabel}>Ja, stornieren</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExpanded(false)} style={styles.cancelNoBtn} activeOpacity={0.8}>
                <Text style={styles.cancelNoLabel}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionSection}>
            <TouchableOpacity style={styles.calBtn} activeOpacity={0.8} onPress={() => exportToCalendar(appt).catch(console.error)}>
              <Text style={styles.calBtnLabel}>In Kalender</Text>
            </TouchableOpacity>
            {cancellable ? (
              <TouchableOpacity onPress={() => setExpanded(true)} style={styles.stornBtn} activeOpacity={0.8}>
                <Text style={styles.stornBtnLabel}>Stornieren</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.stornBtn, { opacity: 0.4 }]}>
                <Text style={styles.stornBtnLabel}>Storno nicht mehr möglich</Text>
              </View>
            )}
          </View>
        )
      )}
    </Card>
  );
}

export function TermineScreen({ appointments, cancelAppointment, setTab }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const [calM, setCalM] = useState(new Date().getMonth());
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const ts = todayStr();

  const prevMonth = () => { const d = new Date(calY, calM - 1); setCalM(d.getMonth()); setCalY(d.getFullYear()); };
  const nextMonth = () => { const d = new Date(calY, calM + 1); setCalM(d.getMonth()); setCalY(d.getFullYear()); };

  // Calendar grid
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const firstDow = (new Date(calY, calM, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Appointments per day (only confirmed)
  const confirmedAppts = appointments.filter(a => a.status === 'confirmed');

  // Filtered list
  const listAppts = selectedDate
    ? appointments.filter(a => a.date === selectedDate)
    : null;

  const upcoming = selectedDate ? [] : [...appointments]
    .filter(a => a.date >= ts && a.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const past = selectedDate ? [] : [...appointments]
    .filter(a => a.date < ts || a.status === 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 20 }]}
      showsVerticalScrollIndicator={false}
      backgroundColor="transparent"
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text style={styles.screenTitle}>Meine Termine</Text>
        <Btn label="Neuen Termin buchen" onPress={() => setTab('buchen')} variant="primary" style={styles.bookBtn} />

        {/* ── Kalender ─────────────────────────────────────── */}
        <Card style={styles.calCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.8}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{DE_MONTHS[calM]} {calY}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.8}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calBody}>
            <View style={styles.weekRow}>
              {DE_DAYS_SHORT.map(d => (
                <View key={d} style={styles.weekCell}>
                  <Text style={styles.weekLabel}>{d}</Text>
                </View>
              ))}
            </View>

            <View style={styles.dayGrid}>
              {cells.map((d, i) => {
                if (!d) return <View key={`e-${i}`} style={styles.dayCell} />;
                const ds = `${calY}-${String(calM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayAppts = confirmedAppts.filter(a => a.date === ds);
                const isSel = selectedDate === ds;
                const isToday = ds === ts;

                return (
                  <TouchableOpacity
                    key={`d-${i}`}
                    onPress={() => setSelectedDate(isSel ? null : ds)}
                    activeOpacity={0.75}
                    style={[
                      styles.dayCell,
                      isSel && styles.dayCellSelected,
                      isToday && !isSel && styles.dayCellToday,
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      isSel && styles.dayTextSelected,
                      isToday && !isSel && styles.dayTextToday,
                    ]}>
                      {d}
                    </Text>
                    {dayAppts.length > 0 && (
                      <View style={styles.dotRow}>
                        {dayAppts.slice(0, 3).map((a, idx) => (
                          <View
                            key={idx}
                            style={[styles.dot, { backgroundColor: isSel ? 'rgba(255,255,255,0.9)' : (PROGRAM_COLORS[a.program] ?? C.accent) }]}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Card>

        {/* ── Legende ───────────────────────────────────────── */}
        <View style={styles.legend}>
          {PROGRAMS.map(p => (
            <View key={p.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PROGRAM_COLORS[p.id] }]} />
              <Text style={styles.legendText}>{p.name}</Text>
            </View>
          ))}
        </View>

        {/* ── Termine Liste ─────────────────────────────────── */}
        {selectedDate ? (
          <>
            <View style={styles.filterHeader}>
              <Text style={styles.filterLabel}>{fmtDate(selectedDate)}</Text>
              <TouchableOpacity onPress={() => setSelectedDate(null)} style={styles.clearBtn} activeOpacity={0.7}>
                <Text style={styles.clearBtnText}>✕ Alle anzeigen</Text>
              </TouchableOpacity>
            </View>
            {listAppts!.length === 0 ? (
              <Text style={styles.emptyText}>Keine Termine an diesem Tag.</Text>
            ) : (
              listAppts!.map(a => <ApptCard key={a.id} appt={a} onCancel={cancelAppointment} />)
            )}
          </>
        ) : (
          <>
            {upcoming.length === 0 && past.length === 0 && (
              <Text style={styles.emptyText}>Noch keine Termine vorhanden.</Text>
            )}
            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Bevorstehend</Text>
                {upcoming.map(a => <ApptCard key={a.id} appt={a} onCancel={cancelAppointment} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Vergangene Termine</Text>
                {past.map(a => <ApptCard key={a.id} appt={a} onCancel={cancelAppointment} />)}
              </>
            )}
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
  bookBtn: { marginBottom: 20 },

  // Kalender
  calCard: { marginBottom: 12, overflow: 'hidden' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: 'rgba(90,140,106,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 20, fontWeight: '700', color: C.accent },
  monthLabel: { fontSize: 17, fontWeight: '700', color: C.text },
  calBody: { padding: 12, paddingBottom: 14 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekLabel: { fontSize: 11, fontWeight: '700', color: C.textMid },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dayCellSelected: { backgroundColor: C.accent },
  dayCellToday: { backgroundColor: C.accentBg },
  dayText: { fontSize: 14, color: C.text, fontWeight: '400' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextToday: { color: C.accent, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  // Legende
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  // Filter-Header
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filterLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  // Liste
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.12,
    marginBottom: 12,
  },
  emptyText: { textAlign: 'center', color: C.textFaint, fontSize: 15, paddingTop: 24 },

  // Appointment Card
  apptCard: { marginBottom: 12 },
  apptMain: { flexDirection: 'row', padding: 18, gap: 12, alignItems: 'flex-start' },
  colorBar: { width: 3, borderRadius: 2, alignSelf: 'stretch', marginTop: 2 },
  apptContent: { flex: 1 },
  apptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  apptTitle: { fontSize: 17, fontWeight: '800' },
  cancelBadge: { backgroundColor: C.redBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  cancelBadgeText: { fontSize: 11, fontWeight: '700', color: C.red },
  apptMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  apptMetaIcon: { fontSize: 13 },
  apptMetaText: { fontSize: 14, color: C.textMid, fontWeight: '500' },
  actionSection: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  calBtn: {
    flex: 1, height: 42, borderRadius: 12,
    backgroundColor: C.accentBg, borderWidth: 1,
    borderColor: 'rgba(90,140,106,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  calBtnLabel: { fontSize: 13, fontWeight: '700', color: C.accent },
  stornBtn: {
    flex: 1, height: 42, borderRadius: 12,
    backgroundColor: C.redBg, borderWidth: 1,
    borderColor: 'rgba(212,90,90,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  stornBtnLabel: { fontSize: 13, fontWeight: '700', color: C.red },
  confirmSection: { borderTopWidth: 1, borderTopColor: C.cardBorder, padding: 16, paddingHorizontal: 20 },
  confirmText: { fontSize: 15, color: C.textMid, marginBottom: 14 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  cancelYesBtn: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.27, shadowRadius: 6, elevation: 3,
  },
  cancelYesLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelNoBtn: {
    flex: 1, height: 46, borderRadius: 12,
    backgroundColor: '#f2f4f3', borderWidth: 1, borderColor: C.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelNoLabel: { fontSize: 15, fontWeight: '600', color: C.textMid },
});
