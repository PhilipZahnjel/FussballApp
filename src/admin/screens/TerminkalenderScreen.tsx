import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { CustomerProfile, AdminAppointment } from '../hooks/useAdminData';
import { PROGRAMS } from '../../constants/programs';
import { SLOTS_MORNING, SLOTS_EVENING } from '../../constants/slots';
import { isBookableDay } from '../../utils/bookingRules';

const PROGRAM_COLORS: Record<string, string> = {
  individual: '#4A8FE8', gruppe: '#3DBFA0', athletik: '#F5A84A',
  torhueter_individual: '#E87676', torhueter_gruppe: '#9B59B6',
};

const DE_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DE_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function dateStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtDate(ds: string) { const [y, m, d] = ds.split('-'); return `${d}.${m}.${y}`; }

function getWeekStart(ref: Date) {
  const d = new Date(ref);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Props {
  customers: CustomerProfile[];
  allAppointments: AdminAppointment[];
  loading: boolean;
  onCancelAppointment: (id: string) => Promise<{ error: any }>;
  onAddAppointment: (userId: string, date: string, time: string, program: string) => Promise<{ error: any }>;
}

export function TerminkalenderScreen({ customers, allAppointments, loading, onCancelAppointment, onAddAppointment }: Props) {
  const [weekRef, setWeekRef] = useState(new Date());
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [bookingDay, setBookingDay] = useState<string | null>(null);
  const [bookCustomerSearch, setBookCustomerSearch] = useState('');
  const [bookCustomerId, setBookCustomerId] = useState<string | null>(null);
  const [bookProgram, setBookProgram] = useState<string>(PROGRAMS[0].id);
  const [bookTime, setBookTime] = useState(SLOTS_MORNING[0]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const weekStart = getWeekStart(weekRef);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const prevWeek = () => { const d = new Date(weekRef); d.setDate(d.getDate() - 7); setWeekRef(d); };
  const nextWeek = () => { const d = new Date(weekRef); d.setDate(d.getDate() + 7); setWeekRef(d); };
  const goToday = () => setWeekRef(new Date());

  const weekLabel = (() => {
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth()) return `${s.getDate()}. – ${e.getDate()}. ${DE_MONTHS[s.getMonth()]} ${s.getFullYear()}`;
    return `${s.getDate()}. ${DE_MONTHS[s.getMonth()]} – ${e.getDate()}. ${DE_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  })();

  const todayStr = dateStr(new Date());

  const handleCancelAppt = async (id: string) => {
    setCancelLoading(true);
    setCancelError(null);
    const { error } = await onCancelAppointment(id);
    setCancelLoading(false);
    if (error) setCancelError(error.message ?? 'Fehler beim Stornieren.');
    else setSelectedApptId(null);
  };

  const openBookingDay = (ds: string) => {
    setBookingDay(ds);
    setBookCustomerSearch('');
    setBookCustomerId(null);
    setBookProgram(PROGRAMS[0].id);
    setBookTime(SLOTS_MORNING[0]);
    setBookingError(null);
    setBookingSuccess(false);
    setSelectedApptId(null);
  };

  const filteredCustomers = bookCustomerSearch.trim().length >= 1
    ? customers.filter(c =>
        c.full_name.toLowerCase().includes(bookCustomerSearch.toLowerCase()) ||
        String(c.customer_number).includes(bookCustomerSearch)
      ).slice(0, 5)
    : [];

  const selectedBookCustomer = bookCustomerId ? customers.find(c => c.id === bookCustomerId) : null;

  const doBook = async () => {
    if (!bookCustomerId || !bookingDay) {
      setBookingError('Bitte einen Kunden auswählen.');
      return;
    }
    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(false);
    const { error } = await onAddAppointment(bookCustomerId, bookingDay, bookTime, bookProgram);
    setBookingLoading(false);
    if (error) {
      setBookingError(error.message ?? 'Buchung fehlgeschlagen.');
    } else {
      setBookingSuccess(true);
      setBookCustomerId(null);
      setBookCustomerSearch('');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#5A8C6A" />;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Terminkalender</Text>
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevWeek} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.todayBtn} onPress={goToday} activeOpacity={0.7}>
            <Text style={styles.todayBtnText}>Heute</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={nextWeek} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {days.map((day, i) => {
            const ds = dateStr(day);
            const dayAppts = allAppointments
              .filter(a => a.date === ds && a.status === 'confirmed')
              .sort((a, b) => a.time.localeCompare(b.time));
            const isToday = ds === todayStr;
            const isWeekend = i >= 5;
            const isBookingThis = bookingDay === ds;
            const isPast = ds < todayStr;
            const canBook = !isPast && isBookableDay(ds);

            return (
              <View key={ds} style={[styles.dayCol, isWeekend && styles.dayColWeekend]}>
                <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{DE_DAYS[i]}</Text>
                  <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{day.getDate()}</Text>
                  {canBook && (
                    <TouchableOpacity
                      style={[styles.addDayBtn, isToday && styles.addDayBtnToday]}
                      onPress={() => isBookingThis ? setBookingDay(null) : openBookingDay(ds)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.addDayBtnText, isToday && styles.addDayBtnTextToday]}>
                        {isBookingThis ? '✕' : '+'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.dayAppts}>
                  {dayAppts.length === 0 ? (
                    <View style={styles.emptyDay} />
                  ) : (
                    dayAppts.map(a => {
                      const customer = customers.find(c => c.id === a.user_id);
                      const prog = PROGRAMS.find(p => p.id === a.program);
                      const color = PROGRAM_COLORS[a.program] ?? '#5A8C6A';
                      const isSelected = selectedApptId === a.id;

                      return (
                        <View key={a.id}>
                          <TouchableOpacity
                            style={[styles.apptChip, { borderLeftColor: color }, isSelected && styles.apptChipSelected]}
                            onPress={() => {
                              setSelectedApptId(isSelected ? null : a.id);
                              setCancelError(null);
                              setBookingDay(null);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.apptTime}>{a.time}</Text>
                            <Text style={[styles.apptProg, { color }]} numberOfLines={1}>{prog?.name ?? a.program}</Text>
                            <Text style={styles.apptCustomer} numberOfLines={1}>{customer?.full_name ?? '—'}</Text>
                          </TouchableOpacity>
                          {isSelected && (
                            <View style={styles.apptActions}>
                              <Text style={styles.apptActionInfo}>
                                {fmtDate(a.date)} · {a.time} Uhr
                              </Text>
                              {cancelError && <Text style={styles.apptActionError}>{cancelError}</Text>}
                              <TouchableOpacity
                                style={[styles.stornBtn, cancelLoading && { opacity: 0.6 }]}
                                onPress={() => handleCancelAppt(a.id)}
                                activeOpacity={0.7}
                                disabled={cancelLoading}
                              >
                                <Text style={styles.stornBtnText}>{cancelLoading ? 'Stornieren...' : 'Termin stornieren'}</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Buchungsformular unter dem Kalender */}
        {bookingDay && (
          <View style={styles.bookingPanel}>
            <Text style={styles.bookingPanelTitle}>Termin buchen · {fmtDate(bookingDay)}</Text>

            {bookingSuccess && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✓ Termin erfolgreich gebucht.</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Kunde suchen</Text>
            {selectedBookCustomer ? (
              <View style={styles.selectedCustomerRow}>
                <Text style={styles.selectedCustomerName}>{selectedBookCustomer.full_name} #{selectedBookCustomer.customer_number}</Text>
                <TouchableOpacity onPress={() => { setBookCustomerId(null); setBookCustomerSearch(''); }} activeOpacity={0.7}>
                  <Text style={styles.clearCustomer}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={bookCustomerSearch}
                  onChangeText={setBookCustomerSearch}
                  placeholder="Name oder Kundennummer..."
                  placeholderTextColor="#9CA3AF"
                />
                {filteredCustomers.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.customerSuggestion}
                    onPress={() => { setBookCustomerId(c.id); setBookCustomerSearch(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.customerSuggestionText}>{c.full_name} · #{c.customer_number}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={styles.fieldLabel}>Programm</Text>
            <View style={styles.chipRow}>
              {PROGRAMS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, bookProgram === p.id && styles.chipActive]}
                  onPress={() => setBookProgram(p.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, bookProgram === p.id && styles.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Uhrzeit</Text>
            <View style={styles.chipRow}>
              {[...SLOTS_MORNING, ...SLOTS_EVENING].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, bookTime === t && styles.chipActive]}
                  onPress={() => setBookTime(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, bookTime === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {bookingError && <Text style={styles.bookingError}>{bookingError}</Text>}

            <TouchableOpacity
              style={[styles.bookBtn, (bookingLoading || !bookCustomerId) && { opacity: 0.5 }]}
              onPress={doBook}
              activeOpacity={0.7}
              disabled={bookingLoading || !bookCustomerId}
            >
              <Text style={styles.bookBtnText}>{bookingLoading ? 'Buchen...' : 'Termin buchen'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { padding: 32, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 20, fontWeight: '600', color: '#374151' },
  todayBtn: { paddingHorizontal: 14, height: 36, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  todayBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  weekLabel: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  grid: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 16 },
  dayCol: { flex: 1, minWidth: 120, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  dayColWeekend: { opacity: 0.65 },
  dayHeader: { padding: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  dayHeaderToday: { backgroundColor: '#5A8C6A' },
  dayName: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNameToday: { color: 'rgba(255,255,255,0.8)' },
  dayNum: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 2 },
  dayNumToday: { color: '#fff' },
  addDayBtn: { marginTop: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(90,140,106,0.15)', alignItems: 'center', justifyContent: 'center' },
  addDayBtnToday: { backgroundColor: 'rgba(255,255,255,0.2)' },
  addDayBtnText: { fontSize: 14, fontWeight: '800', color: '#5A8C6A', lineHeight: 18 },
  addDayBtnTextToday: { color: '#fff' },
  dayAppts: { padding: 8, gap: 6, minHeight: 60 },
  emptyDay: { height: 40 },
  apptChip: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, borderLeftWidth: 3 },
  apptChipSelected: { backgroundColor: '#EEF8F2', borderColor: '#5A8C6A' },
  apptTime: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 2 },
  apptProg: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  apptCustomer: { fontSize: 11, color: '#6B7280' },
  apptActions: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginTop: 4, gap: 6 },
  apptActionInfo: { fontSize: 12, color: '#374151', fontWeight: '600' },
  apptActionError: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  stornBtn: { backgroundColor: '#EF4444', borderRadius: 7, paddingVertical: 7, alignItems: 'center' },
  stornBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  // Buchungsformular
  bookingPanel: { backgroundColor: '#fff', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  bookingPanelTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 16 },
  successBox: { backgroundColor: '#F0FDF4', borderRadius: 8, padding: 12, marginBottom: 12 },
  successText: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', outlineWidth: 0 } as any,
  customerSuggestion: { backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
  customerSuggestionText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  selectedCustomerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(90,140,106,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  selectedCustomerName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  clearCustomer: { fontSize: 16, color: '#9CA3AF', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive: { borderColor: '#5A8C6A', backgroundColor: 'rgba(90,140,106,0.1)' },
  chipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  chipTextActive: { color: '#5A8C6A' },
  bookingError: { fontSize: 13, color: '#EF4444', fontWeight: '600', marginTop: 10 },
  bookBtn: { backgroundColor: '#5A8C6A', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  bookBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
