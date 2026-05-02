import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { Card } from '../components/Card';
import { GlassCard } from '../components/GlassCard';
import { Btn } from '../components/Btn';
import { Appointment, CancellationToken, Tab } from '../types';
import { todayStr, fmtDate, fmtShort, DE_MONTHS, DE_DAYS_SHORT } from '../constants/i18n';
import { SLOTS_MORNING, SLOTS_EVENING } from '../constants/slots';
import { PROGRAMS, PROGRAM_CATEGORY, ProgramId } from '../constants/programs';
import { Profile } from '../hooks/useProfile';
import { germanHolidays } from '../utils/bookingRules';

interface Props {
  appointments: Appointment[];
  myAppointments: Appointment[];
  profile: Profile | null;
  activeTokens: CancellationToken[];
  addAppointment: (date: string, time: string, program: string) => Promise<{ error: any }>;
  setTab: (t: Tab) => void;
}


type Step = 'program' | 'date' | 'time' | 'confirm' | 'done';
const STEPS: Step[] = ['program', 'date', 'time', 'confirm'];

function FadeUp({ children }: { children: React.ReactNode }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    fade.setValue(0); slide.setValue(16);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 320, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.backBtn} activeOpacity={0.7}>
      <Text style={styles.backArrow}>‹</Text>
      <Text style={styles.backLabel}>Zurück</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ t, sub }: { t: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.sectionTitle}>{t}</Text>
      {sub && <Text style={styles.sectionSub}>{sub}</Text>}
    </View>
  );
}

const TORWART_PROGRAMS = new Set(['torhueter_individual', 'torhueter_gruppe']);
const FELD_PROGRAMS = new Set(['individual', 'gruppe', 'athletik']);

function isProgramAllowed(profile: Profile, programId: string): boolean {
  const map: Record<string, keyof Profile> = {
    individual: 'can_book_individual',
    gruppe: 'can_book_gruppe',
    athletik: 'can_book_athletik',
    torhueter_individual: 'can_book_torhueter_individual',
    torhueter_gruppe: 'can_book_torhueter_gruppe',
  };
  const key = map[programId];
  if (!key || !profile[key]) return false;
  if (profile.player_type === 'torwart' && !TORWART_PROGRAMS.has(programId)) return false;
  if (profile.player_type === 'feldspieler' && !FELD_PROGRAMS.has(programId)) return false;
  return true;
}

export function BuchenScreen({ appointments, myAppointments, profile, activeTokens, addAppointment, setTab }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('program');
  const [selProgram, setSelProgram] = useState<string | null>(null);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);
  const [calM, setCalM] = useState(new Date().getMonth());
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [bookingError, setBookingError] = useState<string | null>(null);

  const ts = todayStr();
  const stepIdx = STEPS.indexOf(step);
  const currentProgram = PROGRAMS.find(p => p.id === selProgram);

  const allowedPrograms = profile
    ? PROGRAMS.filter(p => isProgramAllowed(profile, p.id))
    : [];

  const thisMonth = ts.slice(0, 7);
  const usedIndividual = myAppointments.filter(
    a => a.status === 'confirmed' && a.date.startsWith(thisMonth) && PROGRAM_CATEGORY[a.program as ProgramId] === 'individual'
  ).length;
  const usedGruppe = myAppointments.filter(
    a => a.status === 'confirmed' && a.date.startsWith(thisMonth) && PROGRAM_CATEGORY[a.program as ProgramId] === 'gruppe'
  ).length;

  // ── ProgramStep ───────────────────────────────────────────────
  function ProgramStep() {
    const quotaIndividual = profile?.quota_individual ?? 0;
    const quotaGruppe = profile?.quota_gruppe ?? 0;
    const hasIndividualPrograms = allowedPrograms.some(p => PROGRAM_CATEGORY[p.id as ProgramId] === 'individual');
    const hasGruppePrograms = allowedPrograms.some(p => PROGRAM_CATEGORY[p.id as ProgramId] === 'gruppe');
    const tokenIndividual = activeTokens.find(t => t.category === 'individual');
    const tokenGruppe = activeTokens.find(t => t.category === 'gruppe');

    return (
      <FadeUp>
        <SectionTitle t="Nachholtermin buchen" sub="Wähle deine Trainingseinheit" />

        {activeTokens.length > 0 && (
          <View style={styles.tokenBanner}>
            {tokenIndividual && (
              <View style={styles.tokenRow}>
                <Text style={styles.tokenIcon}>🎫</Text>
                <Text style={styles.tokenText}>
                  Nachholtermin Individual bis {fmtDate(tokenIndividual.expires_at.slice(0, 10))}
                </Text>
              </View>
            )}
            {tokenGruppe && (
              <View style={styles.tokenRow}>
                <Text style={styles.tokenIcon}>🎫</Text>
                <Text style={styles.tokenText}>
                  Nachholtermin Gruppe bis {fmtDate(tokenGruppe.expires_at.slice(0, 10))}
                </Text>
              </View>
            )}
          </View>
        )}

        {(quotaIndividual > 0 || quotaGruppe > 0) && (
          <View style={styles.quotaRow}>
            {hasIndividualPrograms && quotaIndividual > 0 && (
              <View style={styles.quotaChip}>
                <Text style={styles.quotaText}>
                  Individual: {Math.max(0, quotaIndividual - usedIndividual)}/{quotaIndividual} diesen Monat
                </Text>
              </View>
            )}
            {hasGruppePrograms && quotaGruppe > 0 && (
              <View style={styles.quotaChip}>
                <Text style={styles.quotaText}>
                  Gruppe: {Math.max(0, quotaGruppe - usedGruppe)}/{quotaGruppe} diesen Monat
                </Text>
              </View>
            )}
          </View>
        )}

        {allowedPrograms.length === 0 ? (
          <View style={styles.noPrograms}>
            <Text style={styles.noProgramsIcon}>⚽</Text>
            <Text style={styles.noProgramsTitle}>Keine Trainingseinheiten verfügbar</Text>
            <Text style={styles.noProgramsText}>Wende dich an deinen Trainer, um Buchungsberechtigungen zu erhalten.</Text>
          </View>
        ) : (
          allowedPrograms.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => { setSelProgram(p.id); setStep('date'); }}
              activeOpacity={0.8}
              style={styles.programCard}
            >
              <View style={[styles.programImagePlaceholder, { backgroundColor: p.color }]}>
                <Text style={styles.programEmoji}>{p.emoji}</Text>
              </View>
              <View style={styles.programBody}>
                <View style={styles.programTop}>
                  <Text style={styles.programName}>{p.name}</Text>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{p.duration} Min.</Text>
                  </View>
                </View>
                <Text style={styles.programDesc}>{p.description}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </FadeUp>
    );
  }

  // ── DateStep ──────────────────────────────────────────────────
  function DateStep() {
    const daysInMonth = new Date(calY, calM + 1, 0).getDate();
    const firstDow = (new Date(calY, calM, 1).getDay() + 6) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const prevMonth = () => { const d = new Date(calY, calM - 1); setCalM(d.getMonth()); setCalY(d.getFullYear()); };
    const nextMonth = () => { const d = new Date(calY, calM + 1); setCalM(d.getMonth()); setCalY(d.getFullYear()); };

    return (
      <FadeUp>
        <BackBtn onPress={() => setStep('program')} />
        <SectionTitle t="Datum wählen" sub={`${currentProgram?.name} · ${currentProgram?.duration} Min.`} />
        <Card>
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
                if (!d) return <View key={`empty-${i}`} style={styles.dayCell} />;
                const ds = `${calY}-${String(calM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dow = new Date(calY, calM, d).getDay();
                const isPast = ds < ts;
                const isWeekend = dow === 0 || dow === 6;
                const isHoliday = germanHolidays(calY).has(ds);
                const isUserBooked = myAppointments.some(a => a.date === ds && a.status === 'confirmed');
                const isSel = selDate === ds;
                const isToday = ds === ts;
                const disabled = isPast || isWeekend || isHoliday;
                return (
                  <TouchableOpacity
                    key={`day-${i}`}
                    disabled={disabled}
                    onPress={() => { setSelDate(ds); setStep('time'); }}
                    activeOpacity={0.7}
                    style={[styles.dayCell, isSel && styles.dayCellSelected, isToday && !isSel && styles.dayCellToday]}
                  >
                    <Text style={[styles.dayText, disabled && styles.dayTextDisabled, isSel && styles.dayTextSelected, isToday && !isSel && styles.dayTextToday]}>
                      {d}
                    </Text>
                    {isUserBooked && !disabled && <View style={styles.bookedDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Card>
      </FadeUp>
    );
  }

  // ── TimeStep ──────────────────────────────────────────────────
  function TimeStep() {
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isToday = selDate === ts;

    const capacity = currentProgram?.capacity ?? 1;
    const SlotGroup = ({ label, slots }: { label: string; slots: string[] }) => (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.slotGroupLabel}>{label}</Text>
        <View style={styles.slotGrid}>
          {slots.map(t => {
            const booked = appointments.filter(a => a.date === selDate && a.time === t && a.program === selProgram && a.status === 'confirmed').length;
            const userBooked = myAppointments.some(a => a.date === selDate && a.time === t && a.status === 'confirmed');
            const isPast = isToday && t <= nowStr;
            const full = booked >= capacity || userBooked || isPast;
            const sel = selTime === t;
            const free = capacity - booked;
            return (
              <TouchableOpacity
                key={t}
                disabled={full}
                onPress={() => setSelTime(t)}
                activeOpacity={0.8}
                style={[styles.slot, sel && styles.slotSelected, full && styles.slotFull]}
              >
                <Text style={[styles.slotTime, full && styles.slotTimeDimmed]}>{t}</Text>
                <Text style={[styles.slotSub, full && styles.slotSubDimmed, !full && free === 1 && { color: '#FFD580' }]}>
                  {isPast ? 'Vergangen' : userBooked ? 'Bereits gebucht' : full ? 'Ausgebucht' : free === 1 ? '1 Platz frei' : `${free} Plätze frei`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );

    return (
      <FadeUp>
        <BackBtn onPress={() => setStep('date')} />
        <SectionTitle t="Uhrzeit wählen" sub={selDate ? fmtShort(selDate) : ''} />
        <SlotGroup label="Morgen" slots={SLOTS_MORNING} />
        <SlotGroup label="Nachmittag / Abend" slots={SLOTS_EVENING} />
        {selTime && <Btn label="Weiter" onPress={() => setStep('confirm')} variant="primary" />}
      </FadeUp>
    );
  }

  // ── ConfirmStep ───────────────────────────────────────────────
  function ConfirmStep() {
    const capacity = currentProgram?.capacity ?? 1;
    const booked = appointments.filter(a => a.date === selDate && a.time === selTime && a.program === selProgram && a.status === 'confirmed').length;
    const doBook = async () => {
      setBookingError(null);
      const { error } = await addAppointment(selDate!, selTime!, selProgram!);
      if (error) {
        setBookingError(error.message ?? 'Buchung fehlgeschlagen.');
      } else {
        setStep('done');
      }
    };
    const rows: [string, string][] = [
      ['Programm', currentProgram?.name ?? ''],
      ['Datum', fmtDate(selDate!)],
      ['Uhrzeit', `${selTime} Uhr`],
      ['Dauer', `${currentProgram?.duration ?? 60} Minuten`],
      ['Verfügbar', `${capacity - booked} von ${capacity} Plätzen frei`],
    ];
    return (
      <FadeUp>
        <BackBtn onPress={() => setStep('time')} />
        <SectionTitle t="Buchung bestätigen" />
        <Card style={{ marginBottom: 20 }}>
          {rows.map(([k, v], i) => (
            <View key={k} style={[styles.summaryRow, i < rows.length - 1 && styles.summaryRowBorder]}>
              <Text style={styles.summaryKey}>{k}</Text>
              <Text style={styles.summaryVal}>{v}</Text>
            </View>
          ))}
        </Card>
        {bookingError && (
          <Text style={styles.errorText}>{bookingError}</Text>
        )}
        <Btn label="Jetzt buchen" onPress={doBook} variant="primary" style={{ marginBottom: 10 }} />
        <Btn label="Abbrechen" onPress={() => setStep('program')} variant="ghost" />
      </FadeUp>
    );
  }

  // ── DoneStep ──────────────────────────────────────────────────
  function DoneStep() {
    const scaleAnim = useRef(new Animated.Value(0.93)).current;
    const fadeAnim2 = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(fadeAnim2, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }, []);
    return (
      <Animated.View style={[styles.doneWrap, { opacity: fadeAnim2, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.doneTitle}>Buchung bestätigt!</Text>
        <Text style={styles.doneMeta}>{currentProgram?.name}</Text>
        <Text style={styles.doneMeta}>{fmtDate(selDate!)}</Text>
        <Text style={styles.doneMeta}>{selTime} Uhr</Text>
        <GlassCard style={styles.emailNote}>
          <Text style={styles.emailNoteText}>📧 Bestätigung folgt per E-Mail</Text>
        </GlassCard>
        <Btn label="Zur Startseite" onPress={() => setTab('home')} variant="primary" style={{ marginBottom: 10, width: '100%' }} />
        <Btn label="Meine Termine" onPress={() => setTab('termine')} variant="ghost" style={{ width: '100%' }} />
      </Animated.View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: 'transparent' }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {step !== 'done' && (
        <>
          <Text style={styles.bookingLabel}>Nachholtermin buchen</Text>
          <View style={styles.progress}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.progressBar, { backgroundColor: i <= stepIdx ? C.accentLight : 'rgba(255,255,255,0.2)' }]} />
            ))}
          </View>
        </>
      )}
      {step === 'program' && <ProgramStep />}
      {step === 'date' && <DateStep />}
      {step === 'time' && <TimeStep />}
      {step === 'confirm' && <ConfirmStep />}
      {step === 'done' && <DoneStep />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  bookingLabel: { fontSize: 13, fontWeight: '700', color: C.textFaint, letterSpacing: 0.1, marginBottom: 8 },
  progress: { flexDirection: 'row', gap: 5, marginBottom: 28 },
  progressBar: { flex: 1, height: 3, borderRadius: 2 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20, alignSelf: 'flex-start' },
  backArrow: { fontSize: 20, color: C.accentLight, fontWeight: '600' },
  backLabel: { fontSize: 15, fontWeight: '600', color: C.accentLight },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sectionSub: { fontSize: 15, color: C.textFaint, marginTop: 4 },
  tokenBanner: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, marginBottom: 14, gap: 6 },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenIcon: { fontSize: 15 },
  tokenText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)', flex: 1 },
  quotaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  quotaChip: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  quotaText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  noPrograms: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  noProgramsIcon: { fontSize: 48, marginBottom: 16 },
  noProgramsTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  noProgramsText: { fontSize: 14, color: C.textFaint, textAlign: 'center', lineHeight: 20 },
  programCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  programImagePlaceholder: { width: '100%', height: 100, alignItems: 'center', justifyContent: 'center' },
  programEmoji: { fontSize: 42 },
  programBody: { padding: 16 },
  programTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  durationBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  durationText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  programName: { fontSize: 16, fontWeight: '800', color: '#fff', flex: 1 },
  programDesc: { fontSize: 13, color: C.textFaint, lineHeight: 19 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.accentBg, borderWidth: 1, borderColor: 'rgba(90,140,106,0.2)', alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 20, fontWeight: '700', color: C.accent },
  monthLabel: { fontSize: 17, fontWeight: '700', color: C.text },
  calBody: { padding: 14, paddingBottom: 16 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekLabel: { fontSize: 12, fontWeight: '700', color: C.textMid },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  dayCellSelected: { backgroundColor: C.accent },
  dayCellToday: { backgroundColor: C.accentBg },
  dayText: { fontSize: 15, color: C.text, fontWeight: '400' },
  dayTextDisabled: { color: '#ccc' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextToday: { color: C.accent, fontWeight: '700' },
  slotGroupLabel: { fontSize: 12, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.1, marginBottom: 10 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '30.5%', height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)' },
  slotSelected: { borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.28)' },
  slotFull: { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.12)' },
  slotTime: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  slotTimeDimmed: { color: 'rgba(255,255,255,0.3)' },
  slotSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 3 },
  slotSubDimmed: { color: 'rgba(255,255,255,0.25)' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  summaryKey: { fontSize: 15, color: C.textMid },
  summaryVal: { fontSize: 15, fontWeight: '700', color: C.text, textAlign: 'right', maxWidth: '55%' },
  doneWrap: { alignItems: 'center', paddingTop: 30 },
  checkCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: C.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 30, elevation: 12 },
  checkMark: { color: '#fff', fontSize: 40, fontWeight: '700' },
  doneTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -0.4 },
  doneMeta: { fontSize: 16, color: C.textFaint, marginBottom: 4 },
  emailNote: { paddingHorizontal: 20, paddingVertical: 14, marginVertical: 32, alignSelf: 'stretch' },
  emailNoteText: { fontSize: 15, color: C.textGlass, textAlign: 'center' },
  bookedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#000', marginTop: 2 },
  errorText: { fontSize: 14, color: '#FF6B6B', textAlign: 'center', marginBottom: 12, fontWeight: '600' },
});
