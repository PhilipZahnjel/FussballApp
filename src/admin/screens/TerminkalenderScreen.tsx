import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
// TextInput retained for customer search field
import { CustomerProfile, AdminAppointment, TrainerProfile } from '../hooks/useAdminData';
import { PROGRAMS, PROGRAM_CATEGORY, ProgramId } from '../../constants/programs';
import { PlayerLevel, LEVEL_COLORS, LEVEL_LABELS } from '../../types';
import { SLOTS } from '../../constants/slots';
import { isBookableDay } from '../../utils/bookingRules';

const PROGRAM_COLORS: Record<string, string> = {
  individual: '#4A8FE8', gruppe: '#3DBFA0', athletik: '#F5A84A',
  torhueter_individual: '#E87676', torhueter_gruppe: '#9B59B6',
};

const DE_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DE_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const ALL_SLOTS = SLOTS;

function pad2(n: number) { return String(n).padStart(2, '0'); }
function dateStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtDate(ds: string) { const [y, m, d] = ds.split('-'); return `${d}.${m}.${y}`; }
function fmtDayLong(ds: string) {
  const d = new Date(ds + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7;
  return `${DE_DAYS[dow]}, ${d.getDate()}. ${DE_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getWeekStart(ref: Date) {
  const d = new Date(ref);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(ds: string, n: number) {
  const d = new Date(ds + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

interface Props {
  customers: CustomerProfile[];
  allAppointments: AdminAppointment[];
  trainers: TrainerProfile[];
  loading: boolean;
  initialDay?: string;
  onCancelAppointment: (id: string) => Promise<{ error: any }>;
  onAddAppointment: (userId: string, date: string, time: string, program: string, trainerId?: string | null, sessionBirthYear?: number | null, sessionLevel?: string | null) => Promise<{ error: any }>;
}

export function TerminkalenderScreen({ customers, allAppointments, trainers, loading, initialDay, onCancelAppointment, onAddAppointment }: Props) {
  const todayStr = dateStr(new Date());
  const { width: winW } = useWindowDimensions();

  const [viewMode, setViewMode] = useState<'week' | 'day'>(initialDay ? 'day' : 'week');
  const [dayDate, setDayDate] = useState(initialDay ?? todayStr);
  const [weekRef, setWeekRef] = useState(new Date());
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  const [bookingDay, setBookingDay] = useState<string | null>(null);
  const [bookCustomerSearch, setBookCustomerSearch] = useState('');
  const [bookCustomerId, setBookCustomerId] = useState<string | null>(null);
  const [bookProgram, setBookProgram] = useState<string>(PROGRAMS[0].id);
  const [bookTime, setBookTime] = useState(SLOTS[0]);
  const [bookTrainerId, setBookTrainerId] = useState<string | null>(null);
  const [bookSessionLevel, setBookSessionLevel] = useState<PlayerLevel | null>(null);
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
  const goToday = () => { setWeekRef(new Date()); setDayDate(todayStr); };

  const weekLabel = (() => {
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth()) return `${s.getDate()}. – ${e.getDate()}. ${DE_MONTHS[s.getMonth()]} ${s.getFullYear()}`;
    return `${s.getDate()}. ${DE_MONTHS[s.getMonth()]} – ${e.getDate()}. ${DE_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  })();

  const switchToDay = (ds: string) => {
    setDayDate(ds);
    setViewMode('day');
    setBookingDay(null);
    setSelectedApptId(null);
  };

  const handleCancelAppt = async (id: string) => {
    setCancelLoading(true);
    setCancelError(null);
    const { error } = await onCancelAppointment(id);
    setCancelLoading(false);
    if (error) setCancelError(error.message ?? 'Fehler beim Stornieren.');
    else setSelectedApptId(null);
  };

  const openBookingDay = (ds: string, presetTime?: string) => {
    setBookingDay(ds);
    setBookCustomerSearch('');
    setBookCustomerId(null);
    setBookProgram(PROGRAMS[0].id);
    setBookTime(presetTime ?? SLOTS[0]);
    setBookTrainerId(null);
    setBookSessionLevel(null);
    setBookingError(null);
    setBookingSuccess(false);
    setSelectedApptId(null);
  };

  const filteredCustomers = bookCustomerSearch.trim().length >= 1
    ? customers.filter(c =>
        (c.full_name ?? '').toLowerCase().includes(bookCustomerSearch.toLowerCase()) ||
        String(c.customer_number).includes(bookCustomerSearch)
      ).slice(0, 5)
    : [];

  const selectedBookCustomer = bookCustomerId ? customers.find(c => c.id === bookCustomerId) : null;

  const bookCustomerBirthYear = selectedBookCustomer?.birth_date
    ? parseInt(selectedBookCustomer.birth_date.slice(0, 4))
    : null;

  const doBook = async () => {
    if (!bookCustomerId || !bookingDay) {
      setBookingError('Bitte einen Kunden auswählen.');
      return;
    }
    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(false);
    const isGruppe = PROGRAM_CATEGORY[bookProgram as ProgramId] === 'gruppe';
    const sBy = isGruppe ? bookCustomerBirthYear : null;
    const sLvl = isGruppe ? bookSessionLevel : null;
    const { error } = await onAddAppointment(bookCustomerId, bookingDay, bookTime, bookProgram, bookTrainerId, sBy, sLvl);
    setBookingLoading(false);
    if (error) {
      setBookingError(error.message ?? 'Buchung fehlgeschlagen.');
    } else {
      setBookingSuccess(true);
      setBookCustomerId(null);
      setBookCustomerSearch('');
      setBookSessionLevel(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#5A8C6A" />;

  // ── Buchungsformular (geteilt zwischen Wochen- und Tagesansicht) ──
  const bookingPanel = bookingDay ? (
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
        {ALL_SLOTS.map(t => (
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

      {trainers.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>Trainer (optional)</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, bookTrainerId === null && styles.chipActive]}
              onPress={() => setBookTrainerId(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, bookTrainerId === null && styles.chipTextActive]}>Kein Trainer</Text>
            </TouchableOpacity>
            {trainers.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.chip, bookTrainerId === t.id && styles.chipActive]}
                onPress={() => setBookTrainerId(t.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, bookTrainerId === t.id && styles.chipTextActive]}>{t.full_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {PROGRAM_CATEGORY[bookProgram as ProgramId] === 'gruppe' && (
        <>
          <Text style={styles.fieldLabel}>Gruppen-Jahrgang</Text>
          {bookCustomerBirthYear ? (
            <View style={styles.birthYearDisplay}>
              <Text style={styles.birthYearText}>Jg. {bookCustomerBirthYear}</Text>
              <Text style={styles.birthYearHint}>(aus Geburtsdatum)</Text>
            </View>
          ) : (
            <View style={styles.birthYearWarning}>
              <Text style={styles.birthYearWarningText}>
                {selectedBookCustomer ? '⚠ Kein Geburtsdatum hinterlegt.' : '⚠ Zuerst einen Kunden auswählen.'}
              </Text>
            </View>
          )}
          <Text style={styles.fieldLabel}>Qualitätsstufe der Gruppe</Text>
          <View style={styles.chipRow}>
            {(['anfaenger', 'amateur', 'profi', 'experte'] as PlayerLevel[]).map(lvl => (
              <TouchableOpacity
                key={lvl}
                style={[styles.chip, bookSessionLevel === lvl && { borderColor: LEVEL_COLORS[lvl], backgroundColor: LEVEL_COLORS[lvl] + '22' }]}
                onPress={() => setBookSessionLevel(bookSessionLevel === lvl ? null : lvl)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, bookSessionLevel === lvl && { color: LEVEL_COLORS[lvl], fontWeight: '700' }]}>
                  {LEVEL_LABELS[lvl]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {bookingError && <Text style={styles.bookingError}>{bookingError}</Text>}

      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.bookBtn, (bookingLoading || !bookCustomerId) && { opacity: 0.5 }, { flex: 1 }]}
          onPress={doBook}
          activeOpacity={0.7}
          disabled={bookingLoading || !bookCustomerId}
        >
          <Text style={styles.bookBtnText}>{bookingLoading ? 'Buchen...' : 'Termin buchen'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelPanelBtn]}
          onPress={() => setBookingDay(null)}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelPanelBtnText}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  // ── TAGESANSICHT ──
  if (viewMode === 'day') {
    const dayAppts = allAppointments
      .filter(a => a.date === dayDate && a.status === 'confirmed')
      .sort((a, b) => a.time.localeCompare(b.time));

    const isPast = dayDate < todayStr;
    const canBook = !isPast && isBookableDay(dayDate);

    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Terminkalender</Text>
          <View style={styles.nav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setDayDate(addDays(dayDate, -1))} activeOpacity={0.7}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.todayBtn} onPress={() => { goToday(); setDayDate(todayStr); }} activeOpacity={0.7}>
              <Text style={styles.todayBtnText}>Heute</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setDayDate(addDays(dayDate, 1))} activeOpacity={0.7}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.viewToggle}>
            <TouchableOpacity style={styles.viewToggleBtn} onPress={() => setViewMode('week')} activeOpacity={0.7}>
              <Text style={styles.viewToggleBtnText}>Wochenansicht</Text>
            </TouchableOpacity>
            <View style={[styles.viewToggleBtn, styles.viewToggleBtnActive]}>
              <Text style={[styles.viewToggleBtnText, styles.viewToggleBtnTextActive]}>Tagesansicht</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}>
          <View style={styles.dayViewHeader}>
            <Text style={styles.dayViewTitle}>{fmtDayLong(dayDate)}</Text>
            {dayDate === todayStr && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>Heute</Text></View>}
            {canBook && (
              <TouchableOpacity
                style={styles.addDayViewBtn}
                onPress={() => bookingDay === dayDate ? setBookingDay(null) : openBookingDay(dayDate)}
                activeOpacity={0.7}
              >
                <Text style={styles.addDayViewBtnText}>{bookingDay === dayDate ? '✕ Abbrechen' : '+ Termin buchen'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {bookingDay === dayDate && bookingPanel}

          {dayAppts.length === 0 && !bookingDay && (
            <View style={styles.emptyDayView}>
              <Text style={styles.emptyDayViewText}>Keine bestätigten Termine für diesen Tag.</Text>
            </View>
          )}

          {dayAppts.length > 0 && (() => {
            const cols = trainers as TrainerProfile[];
            const numCols = cols.length || 1;
            // Fenster minus Sidebar (220px Desktop / 0px Mobile) minus ScrollView-Padding (32px) minus Zeitspalte
            const sidebarW = winW >= 768 ? 220 : 0;
            const availW = winW - sidebarW - 32 - TIME_COL_W;
            const colW = Math.max(150, Math.floor(availW / numCols));

            const selAppt = selectedApptId ? dayAppts.find(a => a.id === selectedApptId) : null;
            const selCust = selAppt ? customers.find(c => c.id === selAppt.user_id) : null;
            const selProg = selAppt ? PROGRAMS.find(p => p.id === selAppt.program) : null;
            const selTrainer = selAppt?.trainer_id ? trainers.find(t => t.id === selAppt.trainer_id) : null;
            const selColor = selAppt ? (PROGRAM_COLORS[selAppt.program] ?? '#5A8C6A') : '#5A8C6A';
            const colStyle = { width: colW };

            return (
              <View>
                <ScrollView horizontal={colW === 150} showsHorizontalScrollIndicator={true}>
                  <View>
                    {/* Header */}
                    <View style={[gStyles.row, gStyles.headerRow]}>
                      <View style={gStyles.timeCol}>
                        <Text style={gStyles.headerText}>Zeit</Text>
                      </View>
                      {cols.map(t => (
                        <View key={t.id} style={[gStyles.trainerCol, colStyle]}>
                          <Text style={gStyles.headerText} numberOfLines={1}>{t.full_name}</Text>
                          {t.trainer_specialty && (
                            <View style={[gStyles.specialtyBadge, { backgroundColor: t.trainer_specialty === 'torwart' ? '#9B59B6' : '#4A8FE8' }]}>
                              <Text style={gStyles.specialtyText}>{t.trainer_specialty === 'torwart' ? 'Torwart' : 'Spieler'}</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Slot rows */}
                    {ALL_SLOTS.map((slot, i) => (
                      <View key={slot} style={[gStyles.row, i % 2 === 1 && gStyles.rowAlt]}>
                        <View style={gStyles.timeCol}>
                          <Text style={gStyles.timeText}>{slot}</Text>
                        </View>
                        {cols.map(t => {
                          const cellAppts = dayAppts.filter(a => a.trainer_id === t.id && a.time === slot);
                          return (
                            <View key={t.id} style={[gStyles.cell, colStyle]}>
                              {cellAppts.map(a => {
                                const cust = customers.find(c => c.id === a.user_id);
                                const color = PROGRAM_COLORS[a.program] ?? '#5A8C6A';
                                const isSel = selectedApptId === a.id;
                                return (
                                  <TouchableOpacity
                                    key={a.id}
                                    style={[gStyles.tag, { backgroundColor: color }, isSel && gStyles.tagSelected]}
                                    onPress={() => { setSelectedApptId(isSel ? null : a.id); setCancelError(null); setBookingDay(null); }}
                                    activeOpacity={0.85}
                                  >
                                    <Text style={gStyles.tagText} numberOfLines={1}>{cust?.full_name ?? '—'}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {selAppt && (
                  <View style={gStyles.selPanel}>
                    <View style={[gStyles.selBar, { backgroundColor: selColor }]} />
                    <View style={gStyles.selInfo}>
                      <Text style={gStyles.selName}>{selCust?.full_name ?? '—'}</Text>
                      <Text style={gStyles.selSub}>
                        {selProg?.name} · {selAppt.time} Uhr{selTrainer ? ` · ${selTrainer.full_name}` : ''}
                      </Text>
                      {cancelError && <Text style={styles.apptActionError}>{cancelError}</Text>}
                      <TouchableOpacity
                        style={[gStyles.stornBtn, cancelLoading && { opacity: 0.6 }]}
                        onPress={() => handleCancelAppt(selAppt.id)}
                        activeOpacity={0.7}
                        disabled={cancelLoading}
                      >
                        <Text style={gStyles.stornBtnText}>{cancelLoading ? 'Stornieren...' : 'Termin stornieren'}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedApptId(null)} style={gStyles.selClose}>
                      <Text style={gStyles.selCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })()}
        </ScrollView>
      </View>
    );
  }

  // ── WOCHENANSICHT ──
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
        <View style={styles.viewToggle}>
          <View style={[styles.viewToggleBtn, styles.viewToggleBtnActive]}>
            <Text style={[styles.viewToggleBtnText, styles.viewToggleBtnTextActive]}>Wochenansicht</Text>
          </View>
          <TouchableOpacity style={styles.viewToggleBtn} onPress={() => switchToDay(todayStr)} activeOpacity={0.7}>
            <Text style={styles.viewToggleBtnText}>Tagesansicht</Text>
          </TouchableOpacity>
        </View>
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
                <TouchableOpacity
                  style={[styles.dayHeader, isToday && styles.dayHeaderToday]}
                  onPress={() => switchToDay(ds)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{DE_DAYS[i]}</Text>
                  <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{day.getDate()}</Text>
                  {canBook && (
                    <TouchableOpacity
                      style={[styles.addDayBtn, isToday && styles.addDayBtnToday]}
                      onPress={(e) => { e.stopPropagation?.(); isBookingThis ? setBookingDay(null) : openBookingDay(ds); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.addDayBtnText, isToday && styles.addDayBtnTextToday]}>
                        {isBookingThis ? '✕' : '+'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <View style={styles.dayAppts}>
                  {dayAppts.length === 0 ? (
                    <View style={styles.emptyDay} />
                  ) : (() => {
                    const grouped = new Map<string, typeof dayAppts>();
                    dayAppts.forEach(a => {
                      const key = `${a.time}|${a.program}|${a.trainer_id ?? ''}`;
                      if (!grouped.has(key)) grouped.set(key, []);
                      grouped.get(key)!.push(a);
                    });
                    return Array.from(grouped.entries()).map(([key, appts]) => {
                      const first = appts[0];
                      const color = PROGRAM_COLORS[first.program] ?? '#5A8C6A';
                      const prog = PROGRAMS.find(p => p.id === first.program);
                      const trainer = first.trainer_id ? trainers.find(t => t.id === first.trainer_id) : null;
                      const isGruppe = PROGRAM_CATEGORY[first.program as ProgramId] === 'gruppe';
                      const cap = isGruppe ? 4 : 1;
                      const isExpanded = expandedGroupKey === key;

                      return (
                        <View key={key}>
                          <TouchableOpacity
                            style={[styles.compactCard, { borderLeftColor: color }, isExpanded && styles.compactCardExpanded]}
                            onPress={() => { setExpandedGroupKey(isExpanded ? null : key); setCancelError(null); setBookingDay(null); }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.compactColorDot, { backgroundColor: color }]} />
                            <View style={styles.compactInfo}>
                              <View style={styles.compactTopRow}>
                                <Text style={styles.compactTime}>{first.time}</Text>
                                <Text style={[styles.compactProg, { color }]} numberOfLines={1}>{prog?.name ?? first.program}</Text>
                              </View>
                              {isGruppe ? (
                                <Text style={styles.compactMeta}>{appts.length}/{cap} Teiln.</Text>
                              ) : (
                                <Text style={styles.compactMeta} numberOfLines={1}>
                                  {customers.find(c => c.id === first.user_id)?.full_name ?? '—'}
                                </Text>
                              )}
                              {trainer && <Text style={styles.compactTrainerLabel} numberOfLines={1}>{trainer.full_name}</Text>}
                            </View>
                            <Text style={styles.expandArrow}>{isExpanded ? '▴' : '▾'}</Text>
                          </TouchableOpacity>

                          {isExpanded && isGruppe && (
                            <View style={styles.expandedParticipants}>
                              {appts.map(a => {
                                const cust = customers.find(c => c.id === a.user_id);
                                const isThis = selectedApptId === a.id;
                                return (
                                  <View key={a.id} style={styles.participantRow}>
                                    <Text style={styles.participantName} numberOfLines={1}>{cust?.full_name ?? '—'}</Text>
                                    {cancelError && isThis && <Text style={styles.apptActionError}>{cancelError}</Text>}
                                    <TouchableOpacity
                                      style={[styles.miniStornBtn, cancelLoading && isThis && { opacity: 0.5 }]}
                                      onPress={() => { setSelectedApptId(a.id); handleCancelAppt(a.id); }}
                                      activeOpacity={0.7}
                                      disabled={cancelLoading && isThis}
                                    >
                                      <Text style={styles.miniStornBtnText}>{cancelLoading && isThis ? '...' : '✕'}</Text>
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          )}

                          {isExpanded && !isGruppe && (
                            <View style={styles.apptActions}>
                              {cancelError && <Text style={styles.apptActionError}>{cancelError}</Text>}
                              <TouchableOpacity
                                style={[styles.stornBtn, cancelLoading && { opacity: 0.6 }]}
                                onPress={() => handleCancelAppt(first.id)}
                                activeOpacity={0.7}
                                disabled={cancelLoading}
                              >
                                <Text style={styles.stornBtnText}>{cancelLoading ? 'Stornieren...' : 'Termin stornieren'}</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    });
                  })()}
                </View>
              </View>
            );
          })}
        </View>

        {bookingPanel}
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
  viewToggle: { flexDirection: 'row', gap: 4, backgroundColor: '#E5E7EB', borderRadius: 10, padding: 3 },
  viewToggleBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  viewToggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 1 },
  viewToggleBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  viewToggleBtnTextActive: { color: '#111827' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 0, paddingBottom: 40 },

  // Wochenansicht
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
  dayAppts: { padding: 6, gap: 5, minHeight: 60 },
  emptyDay: { height: 40 },
  // compact card styles (week view Option B)
  compactCard: { backgroundColor: '#F9FAFB', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 8, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center', gap: 7 },
  compactCardExpanded: { backgroundColor: '#EEF8F2' },
  compactColorDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  compactInfo: { flex: 1, gap: 1 },
  compactTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  compactTime: { fontSize: 11, fontWeight: '800', color: '#374151' },
  compactProg: { fontSize: 10, fontWeight: '700' },
  compactMeta: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  compactTrainerLabel: { fontSize: 10, color: '#9CA3AF' },
  expandArrow: { fontSize: 9, color: '#9CA3AF', flexShrink: 0 },
  expandedParticipants: { backgroundColor: '#FEF2F2', borderRadius: 7, padding: 8, marginTop: 3, gap: 5 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantName: { flex: 1, fontSize: 11, color: '#374151', fontWeight: '600' },
  miniStornBtn: { backgroundColor: '#EF4444', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  miniStornBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  apptActions: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginTop: 3, gap: 6 },
  apptActionInfo: { fontSize: 12, color: '#374151', fontWeight: '600' },
  apptActionError: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  stornBtn: { backgroundColor: '#EF4444', borderRadius: 7, paddingVertical: 7, alignItems: 'center' },
  stornBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Tagesansicht
  dayViewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  dayViewTitle: { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1 },
  todayBadge: { backgroundColor: '#5A8C6A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  todayBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  addDayViewBtn: { backgroundColor: 'rgba(74,127,212,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(74,127,212,0.2)' },
  addDayViewBtnText: { fontSize: 13, fontWeight: '700', color: '#4A7FD4' },
  emptyDayView: { backgroundColor: '#fff', borderRadius: 14, padding: 40, alignItems: 'center' },
  emptyDayViewText: { fontSize: 14, color: '#9CA3AF' },
  slotBlock: { flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'flex-start' },
  slotTimeCol: { width: 50, paddingTop: 14, alignItems: 'flex-end' },
  slotTime: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  slotAppts: { flex: 1, gap: 6 },
  dayApptCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  dayApptCardSelected: { backgroundColor: '#EEF8F2' },
  dayApptColorBar: { width: 4, height: 40, borderRadius: 2 },
  dayApptInfo: { flex: 1 },
  dayApptProg: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  dayApptCustomer: { fontSize: 13, color: '#374151', fontWeight: '600' },
  dayApptTrainer: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  dayApptTime: { fontSize: 13, fontWeight: '700', color: '#6B7280' },

  // Buchungsformular
  bookingPanel: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
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
  cancelPanelBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', marginTop: 16 },
  cancelPanelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  birthYearDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(74,127,212,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  birthYearText: { fontSize: 15, fontWeight: '700', color: '#4A7FD4' },
  birthYearHint: { fontSize: 12, color: '#9CA3AF' },
  birthYearWarning: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  birthYearWarningText: { fontSize: 13, color: '#92400E' },
});

const TIME_COL_W = 90;

const gStyles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E9EF', minHeight: 64 },
  rowAlt: { backgroundColor: '#F8FAFB' },
  headerRow: { backgroundColor: '#1C2133', borderBottomWidth: 0, minHeight: 52 },
  timeCol: { width: TIME_COL_W, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  timeText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  headerText: { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'center' },
  trainerCol: { justifyContent: 'center', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: '#2D3548', gap: 5 },
  specialtyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  specialtyText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cell: { paddingHorizontal: 6, paddingVertical: 6, gap: 4, borderRightWidth: 1, borderRightColor: '#E5E9EF', justifyContent: 'center' },
  tag: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  tagSelected: { borderWidth: 2, borderColor: '#111827', opacity: 0.85 },
  tagText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  selPanel: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 12, gap: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  selBar: { width: 5, height: 48, borderRadius: 3, flexShrink: 0 },
  selInfo: { flex: 1, gap: 4 },
  selName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  selSub: { fontSize: 14, color: '#6B7280' },
  stornBtn: { backgroundColor: '#EF4444', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 6 },
  stornBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  selClose: { padding: 6 },
  selCloseText: { fontSize: 18, color: '#9CA3AF', fontWeight: '700' },
});
