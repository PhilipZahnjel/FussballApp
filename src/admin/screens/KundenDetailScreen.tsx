import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch,
} from 'react-native';
import { CustomerProfile, AdminAppointment, TrainerProfile } from '../hooks/useAdminData';
import { PlayerLevel, PlayerType, LEVEL_COLORS, LEVEL_LABELS, BookingPermissions } from '../../types';
import { PROGRAMS, PROGRAM_CATEGORY, ProgramId } from '../../constants/programs';
import { SLOTS_MORNING, SLOTS_EVENING } from '../../constants/slots';
import { todayStr, fmtDate } from '../../constants/i18n';

const PROGRAM_COLORS: Record<string, string> = {
  individual: '#4A8FE8', gruppe: '#3DBFA0', athletik: '#F5A84A',
  torhueter_individual: '#E87676', torhueter_gruppe: '#9B59B6',
};

const LEVELS: PlayerLevel[] = ['gruen', 'gelb', 'orange', 'rot'];

const PERMISSION_FLAGS: { key: keyof BookingPermissions; label: string }[] = [
  { key: 'can_book_individual', label: 'Individualtraining' },
  { key: 'can_book_gruppe', label: 'Gruppentraining' },
  { key: 'can_book_athletik', label: 'Athletiktraining' },
  { key: 'can_book_torhueter_individual', label: 'Torwart Individual' },
  { key: 'can_book_torhueter_gruppe', label: 'Torwart Gruppe' },
];

const PLAYER_TYPE_OPTIONS: { id: PlayerType; label: string; icon: string }[] = [
  { id: 'feldspieler', label: 'Feldspieler', icon: '⚽' },
  { id: 'torwart', label: 'Torwart', icon: '🧤' },
];

interface Props {
  customer: CustomerProfile;
  appointments: AdminAppointment[];
  trainers: TrainerProfile[];
  onBack: () => void;
  onCancelAppointment: (id: string) => Promise<{ error: any }>;
  onAddAppointment: (userId: string, date: string, time: string, program: string, trainerId?: string | null, sessionBirthYear?: number | null, sessionLevel?: string | null) => Promise<{ error: any }>;
  onSaveLevel: (customerId: string, level: PlayerLevel | null) => Promise<{ error: any }>;
  onSaveBookingPermissions: (customerId: string, permissions: Partial<BookingPermissions>) => Promise<{ error: any }>;
  onSaveProfile: (customerId: string, fields: Partial<Pick<CustomerProfile, 'player_type' | 'parent_name' | 'location' | 'birth_date' | 'phone' | 'address'>>) => Promise<{ error: any }>;
  onDeleteCustomer: (id: string) => Promise<{ error: string | null }>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ApptRow({ appt, onCancel }: { appt: AdminAppointment; onCancel?: (id: string) => void }) {
  const prog = PROGRAMS.find(p => p.id === appt.program);
  const color = PROGRAM_COLORS[appt.program] ?? '#4A7FD4';
  const ts = todayStr();
  const isUpcoming = appt.status === 'confirmed' && appt.date >= ts;
  const dimmed = appt.status === 'cancelled' || appt.date < ts;
  return (
    <View style={[styles.apptRow, dimmed && { opacity: 0.5 }]}>
      <View style={[styles.apptColorBar, { backgroundColor: dimmed ? '#D1D5DB' : color }]} />
      <View style={styles.apptInfo}>
        <Text style={[styles.apptProg, { color: appt.status === 'cancelled' ? '#9CA3AF' : color }]}>{prog?.name ?? appt.program}</Text>
        <Text style={styles.apptDate}>{fmtDate(appt.date)} · {appt.time} Uhr</Text>
      </View>
      {appt.status === 'cancelled' && (
        <View style={styles.cancelledBadge}><Text style={styles.cancelledText}>Storniert</Text></View>
      )}
      {isUpcoming && onCancel && (
        <TouchableOpacity style={styles.stornBtn} onPress={() => onCancel(appt.id)} activeOpacity={0.7}>
          <Text style={styles.stornText}>Stornieren</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function KundenDetailScreen({
  customer, appointments, trainers,
  onBack, onCancelAppointment, onAddAppointment,
  onSaveLevel, onSaveBookingPermissions, onSaveProfile, onDeleteCustomer,
}: Props) {
  const ts = todayStr();

  const birthYear = customer.birth_date ? parseInt(customer.birth_date.slice(0, 4)) : null;

  // Termin buchen
  const [showBooking, setShowBooking] = useState(false);
  const [bookDate, setBookDate] = useState('');
  const [bookProgram, setBookProgram] = useState<string>(PROGRAMS[0].id);
  const [bookTime, setBookTime] = useState(SLOTS_MORNING[0]);
  const [bookTrainerId, setBookTrainerId] = useState<string | null>(null);
  const [bookSessionBirthYear, setBookSessionBirthYear] = useState('');
  const [bookSessionLevel, setBookSessionLevel] = useState<PlayerLevel | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Level
  const [levelLoading, setLevelLoading] = useState(false);
  const [levelError, setLevelError] = useState<string | null>(null);

  // Berechtigungen & Kontingent
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [quotaIndividual, setQuotaIndividual] = useState(String(customer.quota_individual ?? 0));
  const [quotaGruppe, setQuotaGruppe] = useState(String(customer.quota_gruppe ?? 0));

  // Profil-Bearbeitung
  const [editProfile, setEditProfile] = useState(false);
  const [editPlayerType, setEditPlayerType] = useState<PlayerType | null>(customer.player_type);
  const [editParentName, setEditParentName] = useState(customer.parent_name ?? '');
  const [editLocation, setEditLocation] = useState(customer.location ?? '');
  const [editBirthDate, setEditBirthDate] = useState(customer.birth_date ?? '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Löschen
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const upcoming = appointments
    .filter(a => a.date >= ts && a.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const past = appointments
    .filter(a => a.date < ts || a.status === 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date));

  const doBook = async () => {
    setBookingError(null);
    if (!bookDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setBookingError('Format: YYYY-MM-DD'); return; }
    if (isNaN(new Date(bookDate).getTime())) { setBookingError('Ungültiges Datum.'); return; }
    if (bookDate < ts) { setBookingError('Datum darf nicht in der Vergangenheit liegen.'); return; }
    const confirmedOnDay = appointments.filter(a => a.date === bookDate && a.status === 'confirmed');
    if (confirmedOnDay.length > 0) { setBookingError('Bereits ein Termin an diesem Tag.'); return; }
    setBookingLoading(true);
    const isGruppe = PROGRAM_CATEGORY[bookProgram as ProgramId] === 'gruppe';
    const sBy = isGruppe && bookSessionBirthYear ? parseInt(bookSessionBirthYear) : null;
    const sLvl = isGruppe ? bookSessionLevel : null;
    const { error } = await onAddAppointment(customer.id, bookDate, bookTime, bookProgram, bookTrainerId, sBy, sLvl);
    setBookingLoading(false);
    if (error) setBookingError(error.message ?? 'Buchung fehlgeschlagen.');
    else { setShowBooking(false); setBookDate(''); setBookingError(null); setBookTrainerId(null); setBookSessionBirthYear(''); setBookSessionLevel(null); }
  };

  const doSetLevel = async (level: PlayerLevel | null) => {
    setLevelLoading(true);
    setLevelError(null);
    const { error } = await onSaveLevel(customer.id, level);
    setLevelLoading(false);
    if (error) setLevelError(error.message ?? 'Fehler beim Speichern.');
  };

  const doTogglePermission = async (key: keyof BookingPermissions, value: boolean) => {
    setPermError(null);
    const { error } = await onSaveBookingPermissions(customer.id, { [key]: value });
    if (error) setPermError(error.message ?? 'Fehler beim Speichern.');
  };

  const doSaveQuotas = async () => {
    const qi = parseInt(quotaIndividual);
    const qg = parseInt(quotaGruppe);
    if (isNaN(qi) || qi < 0 || qi > 4) { setPermError('Individual-Kontingent muss 0–4 sein.'); return; }
    if (isNaN(qg) || qg < 0 || qg > 4) { setPermError('Gruppen-Kontingent muss 0–4 sein.'); return; }
    setPermLoading(true);
    setPermError(null);
    const { error } = await onSaveBookingPermissions(customer.id, { quota_individual: qi, quota_gruppe: qg });
    setPermLoading(false);
    if (error) setPermError(error.message ?? 'Fehler beim Speichern.');
  };

  const doSaveProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    const { error } = await onSaveProfile(customer.id, {
      player_type: editPlayerType,
      parent_name: editParentName.trim() || null,
      location: editLocation.trim() || null,
      birth_date: editBirthDate.trim() || null,
    });
    setProfileLoading(false);
    if (error) setProfileError((error as any).message ?? 'Fehler beim Speichern.');
    else setEditProfile(false);
  };

  const doDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    const { error } = await onDeleteCustomer(customer.id);
    setDeleteLoading(false);
    if (error) setDeleteError(error);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Zurück zur Spielerliste</Text>
      </TouchableOpacity>

      <View style={styles.pageHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarIconLarge}>
            {customer.player_type === 'torwart' ? '🧤' : '⚽'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName}>{customer.full_name}</Text>
          <Text style={styles.customerSub}>
            {customer.player_type === 'torwart' ? 'Torwart' : customer.player_type === 'feldspieler' ? 'Feldspieler' : 'Spieler'} #{customer.customer_number}
            {birthYear ? ` · Jg. ${birthYear}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteHeaderBtn}
          onPress={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteHeaderBtnText}>Löschen</Text>
        </TouchableOpacity>
      </View>

      {showDeleteConfirm && (
        <View style={styles.deleteConfirmBox}>
          <Text style={styles.deleteConfirmTitle}>Spieler unwiderruflich löschen?</Text>
          <Text style={styles.deleteConfirmSub}>
            Alle Daten von <Text style={{ fontWeight: '700' }}>{customer.full_name}</Text> werden dauerhaft gelöscht.
          </Text>
          {deleteError && <Text style={styles.deleteError}>{deleteError}</Text>}
          <View style={styles.deleteConfirmBtns}>
            <TouchableOpacity style={[styles.deleteConfirmYes, deleteLoading && { opacity: 0.6 }]} onPress={doDelete} disabled={deleteLoading} activeOpacity={0.7}>
              <Text style={styles.deleteConfirmYesText}>{deleteLoading ? 'Wird gelöscht...' : 'Ja, endgültig löschen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteConfirmNo} onPress={() => setShowDeleteConfirm(false)} activeOpacity={0.7}>
              <Text style={styles.deleteConfirmNoText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Kontaktdaten */}
      <SectionCard title="Kontaktdaten">
        {editProfile ? (
          <View style={styles.editSection}>
            <Text style={styles.fieldLabel}>Spielertyp</Text>
            <View style={styles.typeRow}>
              {PLAYER_TYPE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.typeChip, editPlayerType === opt.id && styles.typeChipActive]}
                  onPress={() => setEditPlayerType(opt.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeChipIcon}>{opt.icon}</Text>
                  <Text style={[styles.typeChipText, editPlayerType === opt.id && styles.typeChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Elternname</Text>
            <TextInput style={styles.editInput} value={editParentName} onChangeText={setEditParentName} placeholder="Elternname" placeholderTextColor="#9CA3AF" />
            <Text style={styles.fieldLabel}>Standort</Text>
            <TextInput style={styles.editInput} value={editLocation} onChangeText={setEditLocation} placeholder="z.B. Hattersheim" placeholderTextColor="#9CA3AF" />
            <Text style={styles.fieldLabel}>Geburtsdatum (YYYY-MM-DD)</Text>
            <TextInput style={styles.editInput} value={editBirthDate} onChangeText={setEditBirthDate} placeholder="2010-05-15" placeholderTextColor="#9CA3AF" />
            {profileError && <Text style={styles.fieldError}>{profileError}</Text>}
            <View style={styles.editBtns}>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1 }, profileLoading && { opacity: 0.6 }]} onPress={doSaveProfile} disabled={profileLoading} activeOpacity={0.7}>
                <Text style={styles.saveBtnText}>{profileLoading ? 'Speichern...' : 'Speichern'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelEditBtn, { flex: 1 }]} onPress={() => setEditProfile(false)} activeOpacity={0.7}>
                <Text style={styles.cancelEditText}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <InfoRow label="E-Mail" value={customer.email} />
            <InfoRow label="Telefon" value={customer.phone} />
            {customer.parent_name && <InfoRow label="Elternname" value={customer.parent_name} />}
            <InfoRow label="Geburtsdatum" value={customer.birth_date} />
            {birthYear && <InfoRow label="Jahrgang" value={String(birthYear)} />}
            {customer.location && <InfoRow label="Standort" value={customer.location} />}
            <InfoRow label="Spielertyp" value={customer.player_type === 'torwart' ? '🧤 Torwart' : customer.player_type === 'feldspieler' ? '⚽ Feldspieler' : '—'} />
            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditProfile(true)} activeOpacity={0.7}>
              <Text style={styles.editProfileBtnText}>Bearbeiten</Text>
            </TouchableOpacity>
          </>
        )}
      </SectionCard>

      {/* Qualitätsstufe */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Qualitätsstufe</Text>
        <View style={styles.levelRow}>
          {LEVELS.map(level => {
            const isActive = customer.level === level;
            const color = LEVEL_COLORS[level];
            return (
              <TouchableOpacity
                key={level}
                style={[styles.levelChip, { borderColor: color, backgroundColor: isActive ? color : color + '15' }]}
                onPress={() => doSetLevel(isActive ? null : level)}
                activeOpacity={0.7}
                disabled={levelLoading}
              >
                <Text style={[styles.levelChipText, { color: isActive ? '#fff' : color }]}>
                  {LEVEL_LABELS[level]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!customer.level && <Text style={styles.noLevel}>Keine Qualitätsstufe zugewiesen</Text>}
        {levelError && <Text style={styles.fieldError}>{levelError}</Text>}
      </View>

      {/* Abo / Buchungsberechtigungen */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Abo / Buchungsberechtigungen</Text>
        {PERMISSION_FLAGS.map(({ key, label }) => (
          <View key={key} style={styles.permRow}>
            <Text style={styles.permLabel}>{label}</Text>
            <Switch
              value={!!(customer as any)[key]}
              onValueChange={v => doTogglePermission(key, v)}
              trackColor={{ false: '#E5E7EB', true: '#4A7FD4' }}
              thumbColor="#fff"
            />
          </View>
        ))}

        <Text style={styles.quotaTitle}>Monatliches Guthaben</Text>
        <View style={styles.quotaRow}>
          <View style={styles.quotaField}>
            <Text style={styles.fieldLabel}>Einzeltraining (0–4)</Text>
            <TextInput
              style={styles.quotaInput}
              value={quotaIndividual}
              onChangeText={setQuotaIndividual}
              keyboardType="number-pad"
              maxLength={1}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.quotaField}>
            <Text style={styles.fieldLabel}>Gruppentraining (0–4)</Text>
            <TextInput
              style={styles.quotaInput}
              value={quotaGruppe}
              onChangeText={setQuotaGruppe}
              keyboardType="number-pad"
              maxLength={1}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
        {permError && <Text style={styles.fieldError}>{permError}</Text>}
        <TouchableOpacity
          style={[styles.saveBtn, permLoading && { opacity: 0.6 }]}
          onPress={doSaveQuotas}
          activeOpacity={0.7}
          disabled={permLoading}
        >
          <Text style={styles.saveBtnText}>{permLoading ? 'Speichern...' : 'Guthaben speichern'}</Text>
        </TouchableOpacity>
      </View>

      {/* Termine */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Termine</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowBooking(v => !v)} activeOpacity={0.7}>
            <Text style={styles.addBtnText}>{showBooking ? '✕ Abbrechen' : '+ Termin buchen'}</Text>
          </TouchableOpacity>
        </View>

        {showBooking && (
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Datum (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={bookDate} onChangeText={setBookDate} placeholder="2026-05-01" placeholderTextColor="#9CA3AF" />

            <Text style={styles.fieldLabel}>Training</Text>
            <View style={styles.programRow}>
              {PROGRAMS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.programChip, bookProgram === p.id && styles.programChipActive]}
                  onPress={() => setBookProgram(p.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.programChipText, bookProgram === p.id && styles.programChipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Uhrzeit</Text>
            <View style={styles.slotRow}>
              {[...SLOTS_MORNING, ...SLOTS_EVENING].map(t => {
                const now = new Date();
                const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const isPast = bookDate === ts && t <= nowStr;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.slotChip, bookTime === t && styles.slotChipActive, isPast && styles.slotChipDisabled]}
                    onPress={() => !isPast && setBookTime(t)}
                    activeOpacity={isPast ? 1 : 0.7}
                    disabled={isPast}
                  >
                    <Text style={[styles.slotChipText, bookTime === t && styles.slotChipTextActive, isPast && styles.slotChipTextDisabled]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {trainers.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Trainer (optional)</Text>
                <View style={styles.slotRow}>
                  <TouchableOpacity
                    style={[styles.slotChip, bookTrainerId === null && styles.slotChipActive]}
                    onPress={() => setBookTrainerId(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.slotChipText, bookTrainerId === null && styles.slotChipTextActive]}>Kein Trainer</Text>
                  </TouchableOpacity>
                  {trainers.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.slotChip, bookTrainerId === t.id && styles.slotChipActive]}
                      onPress={() => setBookTrainerId(t.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.slotChipText, bookTrainerId === t.id && styles.slotChipTextActive]}>{t.full_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {PROGRAM_CATEGORY[bookProgram as ProgramId] === 'gruppe' && (
              <>
                <Text style={styles.fieldLabel}>Gruppen-Jahrgang (YYYY)</Text>
                <TextInput
                  style={styles.input}
                  value={bookSessionBirthYear}
                  onChangeText={setBookSessionBirthYear}
                  placeholder="z.B. 2015"
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.fieldLabel}>Qualitätsstufe der Gruppe</Text>
                <View style={styles.slotRow}>
                  {(['gruen', 'gelb', 'orange', 'rot'] as PlayerLevel[]).map(lvl => (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.slotChip, bookSessionLevel === lvl && { borderColor: LEVEL_COLORS[lvl], backgroundColor: LEVEL_COLORS[lvl] + '22' }]}
                      onPress={() => setBookSessionLevel(bookSessionLevel === lvl ? null : lvl)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.slotChipText, bookSessionLevel === lvl && { color: LEVEL_COLORS[lvl], fontWeight: '700' }]}>
                        {LEVEL_LABELS[lvl]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {bookingError && <Text style={styles.fieldError}>{bookingError}</Text>}
            <TouchableOpacity style={[styles.saveBtn, bookingLoading && { opacity: 0.6 }]} onPress={doBook} activeOpacity={0.7} disabled={bookingLoading}>
              <Text style={styles.saveBtnText}>{bookingLoading ? 'Buchen...' : 'Termin buchen'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.apptSection}>Bevorstehend</Text>
            {upcoming.map(a => <ApptRow key={a.id} appt={a} onCancel={onCancelAppointment} />)}
          </>
        )}
        {past.length > 0 && (
          <>
            <Text style={[styles.apptSection, { marginTop: 16 }]}>Vergangen</Text>
            {past.map(a => <ApptRow key={a.id} appt={a} />)}
          </>
        )}
        {upcoming.length === 0 && past.length === 0 && !showBooking && (
          <Text style={styles.emptyAppt}>Keine Termine vorhanden.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  content: { padding: 32 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backArrow: { fontSize: 22, color: '#4A7FD4', fontWeight: '600' },
  backLabel: { fontSize: 14, fontWeight: '600', color: '#4A7FD4' },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(74,127,212,0.1)', alignItems: 'center', justifyContent: 'center' },
  avatarIconLarge: { fontSize: 28 },
  customerName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  customerSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right', maxWidth: '60%' },
  editSection: { paddingTop: 4 },
  editBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', marginBottom: 4, outlineWidth: 0 } as any,
  editProfileBtn: { marginTop: 12, backgroundColor: 'rgba(74,127,212,0.08)', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(74,127,212,0.2)' },
  editProfileBtnText: { fontSize: 13, fontWeight: '700', color: '#4A7FD4' },
  cancelEditBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#F3F4F6' },
  cancelEditText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  typeChipActive: { borderColor: '#4A7FD4', backgroundColor: 'rgba(74,127,212,0.08)' },
  typeChipIcon: { fontSize: 18 },
  typeChipText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  typeChipTextActive: { color: '#4A7FD4' },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  levelChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 2 },
  levelChipText: { fontSize: 14, fontWeight: '700' },
  noLevel: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  permLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  quotaTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  quotaRow: { flexDirection: 'row', gap: 14 },
  quotaField: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  quotaInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', outlineWidth: 0 } as any,
  formSection: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, marginBottom: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', outlineWidth: 0 } as any,
  saveBtn: { backgroundColor: '#4A7FD4', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  addBtn: { backgroundColor: 'rgba(74,127,212,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#4A7FD4' },
  programRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  programChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  programChipActive: { borderColor: '#4A7FD4', backgroundColor: 'rgba(74,127,212,0.1)' },
  programChipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  programChipTextActive: { color: '#4A7FD4' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  slotChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  slotChipActive: { borderColor: '#4A7FD4', backgroundColor: 'rgba(74,127,212,0.1)' },
  slotChipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  slotChipTextActive: { color: '#4A7FD4' },
  slotChipDisabled: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', opacity: 0.5 },
  slotChipTextDisabled: { color: '#D1D5DB' },
  fieldError: { fontSize: 13, color: '#EF4444', fontWeight: '600', marginTop: 10 },
  apptSection: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  emptyAppt: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 20 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  apptColorBar: { width: 3, height: 36, borderRadius: 2 },
  apptInfo: { flex: 1 },
  apptProg: { fontSize: 14, fontWeight: '700' },
  apptDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cancelledBadge: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cancelledText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  stornBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  stornText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  deleteHeaderBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  deleteHeaderBtnText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  deleteConfirmBox: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 14, padding: 20, marginBottom: 16 },
  deleteConfirmTitle: { fontSize: 16, fontWeight: '800', color: '#991B1B', marginBottom: 8 },
  deleteConfirmSub: { fontSize: 14, color: '#7F1D1D', lineHeight: 20, marginBottom: 16 },
  deleteError: { fontSize: 13, color: '#DC2626', fontWeight: '600', marginBottom: 12 },
  deleteConfirmBtns: { flexDirection: 'row', gap: 10 },
  deleteConfirmYes: { flex: 1, backgroundColor: '#EF4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  deleteConfirmYesText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  deleteConfirmNo: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  deleteConfirmNoText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
