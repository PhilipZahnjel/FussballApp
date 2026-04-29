import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { CustomerProfile, AdminAppointment } from '../hooks/useAdminData';
import { SubscriptionPlan, CustomerSubscription, CreditBalance, Measurement } from '../../types';
import { PROGRAMS } from '../../constants/programs';
import { SLOTS_MORNING, SLOTS_EVENING } from '../../constants/slots';
import { validateIban, validateBic } from '../../utils/validation';
import { todayStr, fmtDate } from '../../constants/i18n';

const PROGRAM_COLORS: Record<string, string> = {
  muscle: '#4A8FE8', lymph: '#3DBFA0', relax: '#F5A84A', metabolism: '#E87676',
};

interface Props {
  customer: CustomerProfile;
  appointments: AdminAppointment[];
  subscriptionPlans: SubscriptionPlan[];
  onBack: () => void;
  onCancelAppointment: (id: string) => Promise<{ error: any }>;
  onAddAppointment: (userId: string, date: string, time: string, program: string) => Promise<{ error: any }>;
  onSaveMandate: (customerId: string, ref: string, date: string) => Promise<{ error: any }>;
  onSaveBankDetails: (customerId: string, data: { iban: string; bic: string; account_holder: string; bank_name: string }) => Promise<{ error: any }>;
  onSaveLymphDiscount: (customerId: string, discount: boolean) => Promise<{ error: any }>;
  onDeleteCustomer: (id: string) => Promise<{ error: string | null }>;
  onAssignSubscription: (userId: string, planId: string, startDate: string) => Promise<{ data: CustomerSubscription | null; error: any }>;
  onRemoveSubscription: (subscriptionId: string) => Promise<{ error: any }>;
  onGetCustomerDetails: (userId: string) => Promise<{ subscription: CustomerSubscription | null; credits: CreditBalance }>;
  onAddManualCredit: (userId: string, type: 'ems' | 'lymph', amount: number) => Promise<{ error: any }>;
  onGetMeasurements: (userId: string) => Promise<{ data: Measurement[]; error: any }>;
  onAddMeasurement: (userId: string, fields: Partial<Omit<Measurement, 'id'>>) => Promise<{ error: any }>;
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

const EMPTY_FORM = {
  measured_at: '', weight: '', height: '', resting_pulse: '', blood_pressure_sys: '', blood_pressure_dia: '',
  body_fat: '', body_water: '', fat_free_mass: '', visceral_fat: '', muscle_mass: '', bone_mass: '',
  circumference_chest: '', circumference_hip: '', circumference_waist: '',
  circumference_arm_left: '', circumference_arm_right: '', circumference_leg_left: '', circumference_leg_right: '',
  bmr: '', rmr: '',
};

const parseNum = (s: string) => s.trim() === '' ? null : parseFloat(s.replace(',', '.'));

export function KundenDetailScreen({
  customer, appointments, subscriptionPlans,
  onBack, onCancelAppointment, onAddAppointment, onSaveMandate, onSaveBankDetails,
  onSaveLymphDiscount, onDeleteCustomer, onAssignSubscription, onRemoveSubscription, onGetCustomerDetails,
  onAddManualCredit, onGetMeasurements, onAddMeasurement,
}: Props) {
  const ts = todayStr();

  // Termin buchen
  const [showBooking, setShowBooking] = useState(false);
  const [bookDate, setBookDate] = useState('');
  const [bookProgram, setBookProgram] = useState<string>(PROGRAMS[0].id);
  const [bookTime, setBookTime] = useState(SLOTS_MORNING[0]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Löschen
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // SEPA-Mandat
  const [showMandate, setShowMandate] = useState(false);
  const [mandateRef, setMandateRef] = useState(customer.mandate_reference ?? '');
  const [mandateDate, setMandateDate] = useState(customer.mandate_date ?? '');
  const [mandateLoading, setMandateLoading] = useState(false);
  const [mandateError, setMandateError] = useState<string | null>(null);

  // Bankverbindung
  const [showBank, setShowBank] = useState(false);
  const [bankIban, setBankIban] = useState(customer.iban ?? '');
  const [bankBic, setBankBic] = useState(customer.bic ?? '');
  const [bankHolder, setBankHolder] = useState(customer.account_holder ?? '');
  const [bankName, setBankName] = useState(customer.bank_name ?? '');
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  // Abonnement & Guthaben
  const [subscription, setSubscription] = useState<CustomerSubscription | null>(null);
  const [credits, setCredits] = useState<CreditBalance>({ ems_balance: 0, lymph_balance: 0 });
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [showAssignSub, setShowAssignSub] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(subscriptionPlans[0]?.id ?? '');
  const [subStartDate, setSubStartDate] = useState(ts);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // Lymph-Rabatt
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Manuelles Guthaben
  const [manualCreditType, setManualCreditType] = useState<'ems' | 'lymph'>('ems');
  const [manualCreditAmount, setManualCreditAmount] = useState('');
  const [manualCreditLoading, setManualCreditLoading] = useState(false);
  const [manualCreditError, setManualCreditError] = useState<string | null>(null);
  const [manualCreditSuccess, setManualCreditSuccess] = useState(false);

  // Messungen
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [measurementForm, setMeasurementForm] = useState(EMPTY_FORM);
  const [measurementLoading, setMeasurementLoading] = useState(false);
  const [measurementError, setMeasurementError] = useState<string | null>(null);

  // Interner Tab
  const [detailTab, setDetailTab] = useState<'profil' | 'messungen'>('profil');

  useEffect(() => {
    onGetCustomerDetails(customer.id).then(({ subscription: sub, credits: cr }) => {
      setSubscription(sub);
      setCredits(cr);
      setDetailsLoading(false);
    });
    onGetMeasurements(customer.id).then(({ data }) => setMeasurements(data));
  }, [customer.id]);

  const refreshDetails = async () => {
    const { subscription: sub, credits: cr } = await onGetCustomerDetails(customer.id);
    setSubscription(sub);
    setCredits(cr);
  };

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
    if (confirmedOnDay.length > 0) {
      const isLymphException = bookProgram === 'lymph' || confirmedOnDay.some(a => a.program === 'lymph');
      if (!isLymphException) { setBookingError('Bereits ein Termin an diesem Tag.'); return; }
    }
    setBookingLoading(true);
    const { error } = await onAddAppointment(customer.id, bookDate, bookTime, bookProgram);
    setBookingLoading(false);
    if (error) setBookingError(error.message ?? 'Buchung fehlgeschlagen.');
    else { setShowBooking(false); setBookDate(''); setBookingError(null); refreshDetails(); }
  };

  const doSaveBank = async () => {
    if (!bankHolder.trim()) { setBankError('Kontoinhaber ist Pflichtfeld.'); return; }
    const ibanErr = validateIban(bankIban);
    if (ibanErr) { setBankError(ibanErr); return; }
    const bicErr = validateBic(bankBic);
    if (bicErr) { setBankError(bicErr); return; }
    setBankError(null);
    setBankLoading(true);
    const { error } = await onSaveBankDetails(customer.id, {
      iban: bankIban.trim().replace(/\s/g, '').toUpperCase(),
      bic: bankBic.trim().toUpperCase(),
      account_holder: bankHolder.trim(),
      bank_name: bankName.trim(),
    });
    setBankLoading(false);
    if (error) setBankError(error.message ?? 'Fehler beim Speichern.');
    else setShowBank(false);
  };

  const doSaveMandate = async () => {
    setMandateError(null);
    if (!mandateRef.trim()) { setMandateError('Mandatsreferenz ist Pflichtfeld.'); return; }
    if (!mandateDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setMandateError('Format: YYYY-MM-DD'); return; }
    setMandateLoading(true);
    const { error } = await onSaveMandate(customer.id, mandateRef.trim(), mandateDate);
    setMandateLoading(false);
    if (error) setMandateError((error as any)?.message ?? 'Fehler beim Speichern.');
    else setShowMandate(false);
  };

  const genMandateRef = () => {
    setMandateRef(`MND-${customer.customer_number}-${Date.now()}`);
    const d = new Date();
    setMandateDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const doDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    const { error } = await onDeleteCustomer(customer.id);
    setDeleteLoading(false);
    if (error) setDeleteError(error);
  };

  const doAssignSub = async () => {
    if (!selectedPlanId) { setSubError('Bitte einen Plan auswählen.'); return; }
    setSubLoading(true);
    setSubError(null);
    const { error } = await onAssignSubscription(customer.id, selectedPlanId, subStartDate);
    setSubLoading(false);
    if (error) setSubError(error.message ?? 'Fehler beim Zuweisen.');
    else { setShowAssignSub(false); refreshDetails(); }
  };

  const doRemoveSub = async () => {
    if (!subscription) return;
    setSubLoading(true);
    const { error } = await onRemoveSubscription(subscription.id);
    setSubLoading(false);
    if (error) setSubError(error.message ?? 'Fehler.');
    else { setSubscription(null); }
  };

  const handleCancelAppointment = async (id: string) => {
    const result = await onCancelAppointment(id);
    if (!result.error) refreshDetails();
    return result;
  };

  const doAddManualCredit = async () => {
    const amount = parseInt(manualCreditAmount);
    if (isNaN(amount) || amount === 0) { setManualCreditError('Bitte eine gültige Zahl eingeben (positiv = hinzufügen, negativ = abziehen).'); return; }
    setManualCreditLoading(true);
    setManualCreditError(null);
    setManualCreditSuccess(false);
    const { error } = await onAddManualCredit(customer.id, manualCreditType, amount);
    setManualCreditLoading(false);
    if (error) setManualCreditError(error.message ?? 'Fehler.');
    else { setManualCreditSuccess(true); setManualCreditAmount(''); refreshDetails(); }
  };

  const doToggleDiscount = async (value: boolean) => {
    setDiscountLoading(true);
    setDiscountError(null);
    const { error } = await onSaveLymphDiscount(customer.id, value);
    setDiscountLoading(false);
    if (error) setDiscountError(error.message ?? 'Fehler.');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Zurück zur Kundenliste</Text>
      </TouchableOpacity>

      <View style={styles.pageHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {customer.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName}>{customer.full_name}</Text>
          <Text style={styles.customerSub}>Kunde #{customer.customer_number} · {customer.is_active ? 'Aktiv' : 'Inaktiv'}</Text>
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
          <Text style={styles.deleteConfirmTitle}>Kunden unwiderruflich löschen?</Text>
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

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['profil', 'messungen'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, detailTab === t && styles.tabBtnActive]} onPress={() => setDetailTab(t)} activeOpacity={0.7}>
            <Text style={[styles.tabBtnText, detailTab === t && styles.tabBtnTextActive]}>
              {t === 'profil' ? 'Profil' : `Messungen${measurements.length > 0 ? ` (${measurements.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {detailTab === 'profil' && <>
      {/* Kontaktdaten */}
      <SectionCard title="Kontaktdaten">
        <InfoRow label="E-Mail" value={customer.email} />
        <InfoRow label="Telefon" value={customer.phone} />
        <InfoRow label="Geburtsdatum" value={customer.birth_date} />
        <InfoRow label="Adresse" value={customer.address} />
      </SectionCard>

      {/* Abonnement & Guthaben */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Abonnement & Guthaben</Text>
        </View>

        {detailsLoading ? (
          <ActivityIndicator color="#5A8C6A" style={{ marginVertical: 16 }} />
        ) : (
          <>
            {/* Guthaben-Anzeige */}
            <View style={styles.creditsRow}>
              <View style={[styles.creditBadge, { borderColor: '#4A8FE8' }]}>
                <Text style={[styles.creditNum, { color: credits.ems_balance < 0 ? '#EF4444' : '#4A8FE8' }]}>
                  {credits.ems_balance}
                </Text>
                <Text style={styles.creditLabel}>EMS-Guthaben</Text>
              </View>
              <View style={[styles.creditBadge, { borderColor: '#3DBFA0' }]}>
                <Text style={[styles.creditNum, { color: credits.lymph_balance < 0 ? '#EF4444' : '#3DBFA0' }]}>
                  {credits.lymph_balance}
                </Text>
                <Text style={styles.creditLabel}>Lymph-Guthaben</Text>
              </View>
            </View>

            {/* Aktives Abo */}
            {subscription ? (
              <View style={styles.subCard}>
                <View style={styles.subCardHeader}>
                  <View>
                    <Text style={styles.subPlanName}>{(subscription.plan as any)?.name ?? 'Unbekannter Plan'}</Text>
                    <Text style={styles.subPlanDetails}>
                      {(subscription.plan as any)?.ems_credits_per_month ?? 0}x EMS · {(subscription.plan as any)?.lymph_credits_per_month ?? 0}x Lymph · {(subscription.plan as any)?.monthly_price?.toFixed(2) ?? '—'} €/Monat
                    </Text>
                    <Text style={styles.subStartDate}>Seit {fmtDate(subscription.start_date)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeSubBtn, subLoading && { opacity: 0.6 }]}
                    onPress={doRemoveSub}
                    activeOpacity={0.7}
                    disabled={subLoading}
                  >
                    <Text style={styles.removeSubBtnText}>Kündigen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.noSub}>Kein aktives Abonnement.</Text>
            )}

            {/* Manuelles Guthaben */}
            <View style={styles.manualCreditSection}>
              <Text style={styles.fieldLabel}>Guthaben manuell anpassen</Text>
              <View style={styles.manualCreditRow}>
                <View style={styles.typeToggle}>
                  {(['ems', 'lymph'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, manualCreditType === t && styles.typeBtnActive]}
                      onPress={() => setManualCreditType(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.typeBtnText, manualCreditType === t && styles.typeBtnTextActive]}>
                        {t === 'ems' ? 'EMS' : 'Lymph'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.manualCreditInput}
                  value={manualCreditAmount}
                  onChangeText={v => { setManualCreditAmount(v); setManualCreditSuccess(false); }}
                  placeholder="+4 oder -1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                />
                <TouchableOpacity
                  style={[styles.manualCreditBtn, manualCreditLoading && { opacity: 0.6 }]}
                  onPress={doAddManualCredit}
                  activeOpacity={0.7}
                  disabled={manualCreditLoading}
                >
                  <Text style={styles.manualCreditBtnText}>{manualCreditLoading ? '...' : 'Buchen'}</Text>
                </TouchableOpacity>
              </View>
              {manualCreditError && <Text style={styles.fieldError}>{manualCreditError}</Text>}
              {manualCreditSuccess && <Text style={styles.manualCreditOk}>✓ Guthaben aktualisiert.</Text>}
            </View>

            {/* Abo zuweisen */}
            {!showAssignSub ? (
              <TouchableOpacity style={styles.assignSubBtn} onPress={() => setShowAssignSub(true)} activeOpacity={0.7}>
                <Text style={styles.assignSubBtnText}>{subscription ? 'Abo wechseln' : '+ Abo zuweisen'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.assignSubForm}>
                <Text style={styles.fieldLabel}>Abo-Plan</Text>
                {subscriptionPlans.filter(p => p.is_active).map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.planChip, selectedPlanId === p.id && styles.planChipActive]}
                    onPress={() => setSelectedPlanId(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.planChipName, selectedPlanId === p.id && styles.planChipNameActive]}>
                      {p.name}
                    </Text>
                    <Text style={[styles.planChipSub, selectedPlanId === p.id && styles.planChipSubActive]}>
                      {p.ems_credits_per_month}x EMS · {p.lymph_credits_per_month}x Lymph · {p.monthly_price.toFixed(2)} €
                    </Text>
                  </TouchableOpacity>
                ))}
                {subscriptionPlans.filter(p => p.is_active).length === 0 && (
                  <Text style={styles.noSub}>Keine aktiven Pläne vorhanden. Bitte zuerst im Finanzen-Tab erstellen.</Text>
                )}
                <Text style={styles.fieldLabel}>Startdatum (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={subStartDate} onChangeText={setSubStartDate} placeholderTextColor="#9CA3AF" />
                {subError && <Text style={styles.fieldError}>{subError}</Text>}
                <View style={styles.formBtns}>
                  <TouchableOpacity style={[styles.saveBtn, subLoading && { opacity: 0.6 }]} onPress={doAssignSub} disabled={subLoading} activeOpacity={0.7}>
                    <Text style={styles.saveBtnText}>{subLoading ? 'Speichern...' : 'Abo zuweisen'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelFormBtn} onPress={() => { setShowAssignSub(false); setSubError(null); }} activeOpacity={0.7}>
                    <Text style={styles.cancelFormBtnText}>Abbrechen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* Lymphdrainage-Rabatt */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lymphdrainage-Rabatt</Text>
        <View style={styles.discountRow}>
          <View style={{ flex: 1 }}>
            {customer.lymph_discount ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>Rabatt aktiv</Text>
              </View>
            ) : (
              <Text style={styles.noDiscount}>Kein Rabatt</Text>
            )}
            <Text style={styles.discountHint}>
              {customer.lymph_discount
                ? 'Dieser Kunde zahlt den rabattierten Lymphdrainage-Preis.'
                : 'Rabatt aktivieren, um den festgesetzten Rabattpreis zu gewähren.'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.discountToggle,
              customer.lymph_discount ? styles.discountToggleOn : styles.discountToggleOff,
              discountLoading && { opacity: 0.5 },
            ]}
            onPress={() => doToggleDiscount(!customer.lymph_discount)}
            activeOpacity={0.7}
            disabled={discountLoading}
          >
            <Text style={styles.discountToggleText}>
              {discountLoading ? '...' : customer.lymph_discount ? 'Deaktivieren' : 'Aktivieren'}
            </Text>
          </TouchableOpacity>
        </View>
        {discountError && <Text style={styles.fieldError}>{discountError}</Text>}
      </View>

      {/* Bankverbindung */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Bankverbindung</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => { setShowBank(v => !v); setBankError(null); }} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>{showBank ? '✕ Abbrechen' : 'Bearbeiten'}</Text>
          </TouchableOpacity>
        </View>
        {showBank ? (
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Kontoinhaber *</Text>
            <TextInput style={styles.input} value={bankHolder} onChangeText={setBankHolder} placeholder="Max Mustermann" placeholderTextColor="#9CA3AF" />
            <Text style={styles.fieldLabel}>IBAN *</Text>
            <TextInput style={styles.input} value={bankIban} onChangeText={setBankIban} placeholder="DE89 3704 0044 0532 0130 00" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />
            <Text style={styles.fieldLabel}>BIC *</Text>
            <TextInput style={styles.input} value={bankBic} onChangeText={setBankBic} placeholder="COBADEFFXXX" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />
            <Text style={styles.fieldLabel}>Kreditinstitut</Text>
            <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="Commerzbank" placeholderTextColor="#9CA3AF" />
            {bankError && <Text style={styles.fieldError}>{bankError}</Text>}
            <TouchableOpacity style={[styles.saveBtn, bankLoading && { opacity: 0.6 }]} onPress={doSaveBank} activeOpacity={0.7} disabled={bankLoading}>
              <Text style={styles.saveBtnText}>{bankLoading ? 'Speichern...' : 'Bankverbindung speichern'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <InfoRow label="Kontoinhaber" value={customer.account_holder} />
            <InfoRow label="IBAN" value={customer.iban} />
            <InfoRow label="BIC" value={customer.bic} />
            <InfoRow label="Bank" value={customer.bank_name} />
          </>
        )}
      </View>

      {/* SEPA-Mandat */}
      <SectionCard title="SEPA-Mandat">
        <InfoRow label="Mandatsreferenz" value={customer.mandate_reference} />
        <InfoRow label="Mandatsdatum" value={customer.mandate_date} />
        {showMandate ? (
          <View style={styles.formSection}>
            <TouchableOpacity style={styles.genBtn} onPress={genMandateRef} activeOpacity={0.7}>
              <Text style={styles.genBtnText}>Referenz auto-generieren</Text>
            </TouchableOpacity>
            <Text style={styles.fieldLabel}>Mandatsreferenz</Text>
            <TextInput style={styles.input} value={mandateRef} onChangeText={setMandateRef} placeholder="MND-..." placeholderTextColor="#9CA3AF" />
            <Text style={styles.fieldLabel}>Mandatsdatum (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={mandateDate} onChangeText={setMandateDate} placeholder="2026-01-01" placeholderTextColor="#9CA3AF" />
            {mandateError && <Text style={styles.fieldError}>{mandateError}</Text>}
            <View style={styles.formBtns}>
              <TouchableOpacity style={[styles.saveBtn, mandateLoading && { opacity: 0.6 }]} onPress={doSaveMandate} activeOpacity={0.7} disabled={mandateLoading}>
                <Text style={styles.saveBtnText}>{mandateLoading ? 'Speichern...' : 'Speichern'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelFormBtn} onPress={() => { setShowMandate(false); setMandateError(null); }} activeOpacity={0.7}>
                <Text style={styles.cancelFormBtnText}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={() => setShowMandate(true)} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>Mandat bearbeiten</Text>
          </TouchableOpacity>
        )}
      </SectionCard>

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

            <Text style={styles.fieldLabel}>Programm</Text>
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

            {bookingError && <Text style={styles.fieldError}>{bookingError}</Text>}
            <TouchableOpacity style={[styles.saveBtn, bookingLoading && { opacity: 0.6 }]} onPress={doBook} activeOpacity={0.7} disabled={bookingLoading}>
              <Text style={styles.saveBtnText}>{bookingLoading ? 'Buchen...' : 'Termin buchen'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.apptSection}>Bevorstehend</Text>
            {upcoming.map(a => <ApptRow key={a.id} appt={a} onCancel={handleCancelAppointment} />)}
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

      </>}

      {detailTab === 'messungen' && <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Messungen</Text>
          <TouchableOpacity onPress={() => { setShowMeasurementForm(v => !v); setMeasurementError(null); }} activeOpacity={0.7}
            style={styles.addBtn}>
            <Text style={styles.addBtnText}>{showMeasurementForm ? 'Abbrechen' : '+ Neue Messung'}</Text>
          </TouchableOpacity>
        </View>

        {showMeasurementForm && (
          <View style={styles.measureForm}>
            {measurementError && <Text style={styles.errorText}>{measurementError}</Text>}

            <Text style={styles.measureGroup}>Allgemein</Text>
            <MeasureInput label="Messdatum (JJJJ-MM-TT)" value={measurementForm.measured_at} onChangeText={v => setMeasurementForm(f => ({ ...f, measured_at: v }))} placeholder={new Date().toISOString().split('T')[0]} />
            <MeasureInput label="Gewicht (kg)" value={measurementForm.weight} onChangeText={v => setMeasurementForm(f => ({ ...f, weight: v }))} />
            <MeasureInput label="Größe (cm)" value={measurementForm.height} onChangeText={v => setMeasurementForm(f => ({ ...f, height: v }))} />

            <Text style={styles.measureGroup}>Vitalwerte</Text>
            <MeasureInput label="Ruhepuls (bpm)" value={measurementForm.resting_pulse} onChangeText={v => setMeasurementForm(f => ({ ...f, resting_pulse: v }))} />
            <MeasureInput label="Blutdruck systolisch (mmHg)" value={measurementForm.blood_pressure_sys} onChangeText={v => setMeasurementForm(f => ({ ...f, blood_pressure_sys: v }))} />
            <MeasureInput label="Blutdruck diastolisch (mmHg)" value={measurementForm.blood_pressure_dia} onChangeText={v => setMeasurementForm(f => ({ ...f, blood_pressure_dia: v }))} />

            <Text style={styles.measureGroup}>Körperzusammensetzung (InBody)</Text>
            <MeasureInput label="Körperfett (%)" value={measurementForm.body_fat} onChangeText={v => setMeasurementForm(f => ({ ...f, body_fat: v }))} />
            <MeasureInput label="Muskelmasse (kg)" value={measurementForm.muscle_mass} onChangeText={v => setMeasurementForm(f => ({ ...f, muscle_mass: v }))} />
            <MeasureInput label="Fettfreie Masse (kg)" value={measurementForm.fat_free_mass} onChangeText={v => setMeasurementForm(f => ({ ...f, fat_free_mass: v }))} />
            <MeasureInput label="Körperwasser (%)" value={measurementForm.body_water} onChangeText={v => setMeasurementForm(f => ({ ...f, body_water: v }))} />
            <MeasureInput label="Viszeralfett (Level)" value={measurementForm.visceral_fat} onChangeText={v => setMeasurementForm(f => ({ ...f, visceral_fat: v }))} />
            <MeasureInput label="Knochenmasse (kg)" value={measurementForm.bone_mass} onChangeText={v => setMeasurementForm(f => ({ ...f, bone_mass: v }))} />

            <Text style={styles.measureGroup}>Umfang (cm)</Text>
            <MeasureInput label="Taille" value={measurementForm.circumference_waist} onChangeText={v => setMeasurementForm(f => ({ ...f, circumference_waist: v }))} />
            <MeasureInput label="Brust" value={measurementForm.circumference_chest} onChangeText={v => setMeasurementForm(f => ({ ...f, circumference_chest: v }))} />
            <MeasureInput label="Hüfte" value={measurementForm.circumference_hip} onChangeText={v => setMeasurementForm(f => ({ ...f, circumference_hip: v }))} />
            <MeasureInput label="Arm links" value={measurementForm.circumference_arm_left} onChangeText={v => setMeasurementForm(f => ({ ...f, circumference_arm_left: v }))} />
            <MeasureInput label="Arm rechts" value={measurementForm.circumference_arm_right} onChangeText={v => setMeasurementForm(f => ({ ...f, circumference_arm_right: v }))} />
            <MeasureInput label="Bein links" value={measurementForm.circumference_leg_left} onChangeText={v => setMeasurementForm(f => ({ ...f, circumference_leg_left: v }))} />
            <MeasureInput label="Bein rechts" value={measurementForm.circumference_leg_right} onChangeText={v => setMeasurementForm(f => ({ ...f, circumference_leg_right: v }))} />

            <Text style={styles.measureGroup}>Stoffwechsel</Text>
            <MeasureInput label="Grundumsatz BMR (kcal)" value={measurementForm.bmr} onChangeText={v => setMeasurementForm(f => ({ ...f, bmr: v }))} />
            <MeasureInput label="Ruheumsatz RMR (kcal)" value={measurementForm.rmr} onChangeText={v => setMeasurementForm(f => ({ ...f, rmr: v }))} />

            <TouchableOpacity
              style={[styles.saveBtn, measurementLoading && { opacity: 0.6 }]}
              onPress={async () => {
                const date = measurementForm.measured_at.trim() || new Date().toISOString().split('T')[0];
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                  setMeasurementError('Datum im Format JJJJ-MM-TT eingeben.');
                  return;
                }
                setMeasurementLoading(true);
                setMeasurementError(null);
                const { error } = await onAddMeasurement(customer.id, {
                  measured_at: date,
                  weight: parseNum(measurementForm.weight),
                  height: parseNum(measurementForm.height),
                  resting_pulse: parseNum(measurementForm.resting_pulse),
                  blood_pressure_sys: parseNum(measurementForm.blood_pressure_sys),
                  blood_pressure_dia: parseNum(measurementForm.blood_pressure_dia),
                  body_fat: parseNum(measurementForm.body_fat),
                  body_water: parseNum(measurementForm.body_water),
                  fat_free_mass: parseNum(measurementForm.fat_free_mass),
                  visceral_fat: parseNum(measurementForm.visceral_fat),
                  muscle_mass: parseNum(measurementForm.muscle_mass),
                  bone_mass: parseNum(measurementForm.bone_mass),
                  circumference_chest: parseNum(measurementForm.circumference_chest),
                  circumference_hip: parseNum(measurementForm.circumference_hip),
                  circumference_waist: parseNum(measurementForm.circumference_waist),
                  circumference_arm_left: parseNum(measurementForm.circumference_arm_left),
                  circumference_arm_right: parseNum(measurementForm.circumference_arm_right),
                  circumference_leg_left: parseNum(measurementForm.circumference_leg_left),
                  circumference_leg_right: parseNum(measurementForm.circumference_leg_right),
                  bmr: parseNum(measurementForm.bmr),
                  rmr: parseNum(measurementForm.rmr),
                });
                setMeasurementLoading(false);
                if (error) { setMeasurementError(error.message ?? 'Fehler beim Speichern.'); return; }
                const { data } = await onGetMeasurements(customer.id);
                setMeasurements(data);
                setMeasurementForm(EMPTY_FORM);
                setShowMeasurementForm(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{measurementLoading ? 'Speichern…' : 'Messung speichern'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {measurements.length === 0 && !showMeasurementForm && (
          <Text style={styles.emptyAppt}>Noch keine Messungen vorhanden.</Text>
        )}
        {measurements.map((m, i) => (
          <View key={m.id} style={[styles.measureRow, i < measurements.length - 1 && styles.measureRowBorder]}>
            <Text style={styles.measureDate}>{m.measured_at?.split('T')[0] ?? '—'}</Text>
            <View style={styles.measureStats}>
              {m.weight != null && <Text style={styles.measureStat}>{m.weight} kg</Text>}
              {m.body_fat != null && <Text style={styles.measureStat}>{m.body_fat}% Fett</Text>}
              {m.muscle_mass != null && <Text style={styles.measureStat}>{m.muscle_mass} kg Muskel</Text>}
            </View>
          </View>
        ))}
      </View>}
    </ScrollView>
  );
}

function MeasureInput({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.measureInputRow}>
      <Text style={styles.measureInputLabel}>{label}</Text>
      <TextInput
        style={styles.measureInputField}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? '—'}
        placeholderTextColor="#9CA3AF"
        keyboardType="decimal-pad"
      />
    </View>
  );
}

function ApptRow({ appt, onCancel }: { appt: AdminAppointment; onCancel?: (id: string) => void }) {
  const prog = PROGRAMS.find(p => p.id === appt.program);
  const color = PROGRAM_COLORS[appt.program] ?? '#5A8C6A';
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  content: { padding: 32 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backArrow: { fontSize: 22, color: '#5A8C6A', fontWeight: '600' },
  backLabel: { fontSize: 14, fontWeight: '600', color: '#5A8C6A' },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(90,140,106,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#5A8C6A' },
  customerName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  customerSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right', maxWidth: '60%' },
  // Guthaben
  creditsRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  creditBadge: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 14, alignItems: 'center' },
  creditNum: { fontSize: 28, fontWeight: '900' },
  creditLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  // Abo
  subCard: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 14, marginBottom: 12 },
  subCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  subPlanName: { fontSize: 15, fontWeight: '800', color: '#14532D' },
  subPlanDetails: { fontSize: 12, color: '#166534', marginTop: 4 },
  subStartDate: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  removeSubBtn: { backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  removeSubBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  noSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 12, fontStyle: 'italic' },
  assignSubBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(90,140,106,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  assignSubBtnText: { fontSize: 13, fontWeight: '700', color: '#5A8C6A' },
  assignSubForm: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginTop: 12 },
  planChip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 8, backgroundColor: '#fff' },
  planChipActive: { borderColor: '#5A8C6A', backgroundColor: 'rgba(90,140,106,0.06)' },
  planChipName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  planChipNameActive: { color: '#5A8C6A' },
  planChipSub: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  planChipSubActive: { color: '#5A8C6A' },
  // Formular
  formSection: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', outlineWidth: 0 } as any,
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#5A8C6A', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cancelFormBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  cancelFormBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  genBtn: { alignSelf: 'flex-start', backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 },
  genBtnText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },
  editBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: 'rgba(90,140,106,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#5A8C6A' },
  addBtn: { backgroundColor: 'rgba(90,140,106,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#5A8C6A' },
  programRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  programChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  programChipActive: { borderColor: '#5A8C6A', backgroundColor: 'rgba(90,140,106,0.1)' },
  programChipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  programChipTextActive: { color: '#5A8C6A' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  slotChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  slotChipActive: { borderColor: '#5A8C6A', backgroundColor: 'rgba(90,140,106,0.1)' },
  slotChipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  slotChipTextActive: { color: '#5A8C6A' },
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
  manualCreditSection: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14, marginTop: 4 },
  manualCreditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  typeToggle: { flexDirection: 'row', gap: 6 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  typeBtnActive: { borderColor: '#5A8C6A', backgroundColor: 'rgba(90,140,106,0.1)' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  typeBtnTextActive: { color: '#5A8C6A' },
  manualCreditInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#111827', outlineWidth: 0 } as any,
  manualCreditBtn: { backgroundColor: '#5A8C6A', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  manualCreditBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  manualCreditOk: { fontSize: 12, color: '#15803D', fontWeight: '600', marginTop: 6 },
  discountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  discountBadge: { alignSelf: 'flex-start', backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  discountBadgeText: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  noDiscount: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', marginBottom: 6 },
  discountHint: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  discountToggle: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  discountToggleOn: { backgroundColor: 'rgba(239,68,68,0.1)' },
  discountToggleOff: { backgroundColor: 'rgba(90,140,106,0.1)' },
  discountToggleText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  // Tab Bar
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#5A8C6A' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabBtnTextActive: { color: '#fff' },
  // Messungen
  addBtn: { backgroundColor: 'rgba(90,140,106,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#5A8C6A' },
  measureForm: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14, marginTop: 4 },
  measureGroup: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  measureInputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  measureInputLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  measureInputField: { width: 110, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: '#111827', textAlign: 'right', outlineWidth: 0 } as any,
  saveBtn: { backgroundColor: '#5A8C6A', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  measureRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  measureDate: { fontSize: 14, fontWeight: '700', color: '#111827' },
  measureStats: { flexDirection: 'row', gap: 10 },
  measureStat: { fontSize: 13, color: '#6B7280' },
});
