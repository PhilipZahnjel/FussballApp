import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CustomerProfile, PendingCharge } from '../hooks/useAdminData';
import { SubscriptionPlan } from '../../types';
import { generateSepaXml, downloadXml } from '../utils/sepa';
import { STUDIO_SEPA } from '../../constants/studio';

function pad2(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

interface Props {
  customers: CustomerProfile[];
  subscriptionPlans: SubscriptionPlan[];
  loading: boolean;
  onAddCharge: (userId: string, amount: number, description: string, period: string) => Promise<{ data: any; error: any }>;
  onRunMonthlyBilling: (period: string) => Promise<{ billed: number; skipped: number; error: string | null }>;
  onGetPendingCharges: (period: string) => Promise<{ data: PendingCharge[]; error: any }>;
  onCreatePlan: (plan: Omit<SubscriptionPlan, 'id' | 'is_active'>) => Promise<{ data: any; error: any }>;
  onUpdatePlan: (id: string, updates: Partial<SubscriptionPlan>) => Promise<{ error: any }>;
  onDeletePlan: (id: string) => Promise<{ error: any }>;
}

export function FinanzenScreen({
  customers, subscriptionPlans, loading,
  onAddCharge, onRunMonthlyBilling, onGetPendingCharges,
  onCreatePlan, onUpdatePlan, onDeletePlan,
}: Props) {
  const [collectionDate, setCollectionDate] = useState(todayStr());
  const [period, setPeriod] = useState(todayStr().slice(0, 7));
  const [charges, setCharges] = useState<Record<string, string>>({});
  const [chargeBreakdown, setChargeBreakdown] = useState<Record<string, PendingCharge[]>>({});
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Abo-Pläne verwalten
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [planEms, setPlanEms] = useState('');
  const [planLymph, setPlanLymph] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planExtraEms, setPlanExtraEms] = useState('25.00');
  const [planExtraLymph, setPlanExtraLymph] = useState('20.00');
  const [planDiscountedLymph, setPlanDiscountedLymph] = useState('15.00');
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const sepaCustomers = customers.filter(c => c.iban && c.bic && c.mandate_reference && c.mandate_date && c.is_active);
  const chargesWithAmount = Object.entries(charges).filter(([, v]) => parseFloat(v) > 0);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#5A8C6A" />;

  const runBilling = async () => {
    setBillingLoading(true);
    setStatusMsg(null);
    const result = await onRunMonthlyBilling(period);
    setBillingLoading(false);
    if (result.error) {
      setStatusMsg({ type: 'error', text: result.error });
    } else {
      setStatusMsg({ type: 'success', text: `Abrechnung abgeschlossen: ${result.billed} Kunden abgerechnet, ${result.skipped} bereits vorhanden.` });
    }
  };

  const autoFillCharges = async () => {
    setAutoFillLoading(true);
    setStatusMsg(null);
    const { data: pending, error } = await onGetPendingCharges(period);
    setAutoFillLoading(false);
    if (error) { setStatusMsg({ type: 'error', text: error.message ?? 'Fehler beim Laden.' }); return; }

    const totals: Record<string, number> = {};
    const breakdown: Record<string, PendingCharge[]> = {};
    for (const charge of pending) {
      totals[charge.user_id] = (totals[charge.user_id] ?? 0) + charge.amount;
      breakdown[charge.user_id] = [...(breakdown[charge.user_id] ?? []), charge];
    }
    const newCharges: Record<string, string> = {};
    for (const [userId, total] of Object.entries(totals)) {
      newCharges[userId] = total.toFixed(2);
    }
    setCharges(newCharges);
    setChargeBreakdown(breakdown);
    if (Object.keys(newCharges).length === 0) {
      setStatusMsg({ type: 'error', text: `Keine offenen Positionen für ${period} gefunden. Zuerst "Monat abrechnen" ausführen.` });
    } else {
      setStatusMsg({ type: 'success', text: `${Object.keys(newCharges).length} Kunden · ${pending.length} Positionen geladen.` });
    }
  };

  const generateAndDownload = async () => {
    setStatusMsg(null);
    if (!STUDIO_SEPA.iban || !STUDIO_SEPA.bic || !STUDIO_SEPA.creditorId) {
      setStatusMsg({ type: 'error', text: 'Studio-SEPA-Daten fehlen. Bitte in src/constants/studio.ts eintragen.' });
      return;
    }
    if (chargesWithAmount.length === 0) {
      setStatusMsg({ type: 'error', text: 'Bitte mindestens einen Betrag eingeben oder "Auto-befüllen" klicken.' });
      return;
    }

    setGenerating(true);
    const transactions = chargesWithAmount.map(([customerId, amount]) => {
      const c = customers.find(x => x.id === customerId)!;
      return {
        endToEndId: `E2E-${c.customer_number}-${Date.now()}`,
        amount: parseFloat(amount),
        mandateReference: c.mandate_reference!,
        mandateDate: c.mandate_date!,
        debtorName: c.account_holder ?? c.full_name,
        debtorIban: c.iban!,
        debtorBic: c.bic!,
        description: `EMS Monatsbeitrag ${period}`,
      };
    }).filter(t => t.mandateReference);

    const xml = generateSepaXml(transactions, STUDIO_SEPA, collectionDate);
    downloadXml(xml, `sepa-lastschrift-${period}.xml`);

    setGenerating(false);
    setCharges({});
    setStatusMsg({ type: 'success', text: `SEPA-Datei für ${transactions.length} Kunden erstellt.` });
  };

  const openNewPlan = () => {
    setEditingPlan(null);
    setPlanName(''); setPlanEms('0'); setPlanLymph('0');
    setPlanPrice(''); setPlanExtraEms('25.00'); setPlanExtraLymph('20.00');
    setPlanError(null);
    setShowPlanForm(true);
  };

  const openEditPlan = (p: SubscriptionPlan) => {
    setEditingPlan(p);
    setPlanName(p.name); setPlanEms(String(p.ems_credits_per_month)); setPlanLymph(String(p.lymph_credits_per_month));
    setPlanPrice(String(p.monthly_price)); setPlanExtraEms(String(p.extra_ems_price)); setPlanExtraLymph(String(p.extra_lymph_price));
    setPlanDiscountedLymph(String(p.discounted_lymph_price));
    setPlanError(null);
    setShowPlanForm(true);
  };

  const savePlan = async () => {
    if (!planName.trim()) { setPlanError('Name ist Pflichtfeld.'); return; }
    const price = parseFloat(planPrice);
    if (isNaN(price) || price < 0) { setPlanError('Ungültiger Monatspreis.'); return; }
    setPlanLoading(true);
    setPlanError(null);
    const planData = {
      name: planName.trim(),
      ems_credits_per_month: parseInt(planEms) || 0,
      lymph_credits_per_month: parseInt(planLymph) || 0,
      monthly_price: price,
      extra_ems_price: parseFloat(planExtraEms) || 25,
      extra_lymph_price: parseFloat(planExtraLymph) || 25,
      discounted_lymph_price: parseFloat(planDiscountedLymph) || 15,
    };
    if (editingPlan) {
      const { error } = await onUpdatePlan(editingPlan.id, planData);
      setPlanLoading(false);
      if (error) setPlanError(error.message ?? 'Fehler.');
      else setShowPlanForm(false);
    } else {
      const { error } = await onCreatePlan(planData);
      setPlanLoading(false);
      if (error) setPlanError(error.message ?? 'Fehler.');
      else setShowPlanForm(false);
    }
  };

  const totalAmount = chargesWithAmount.reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Finanzen</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {statusMsg && (
          <View style={[styles.statusBox, statusMsg.type === 'error' ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusText, statusMsg.type === 'error' ? styles.statusTextError : styles.statusTextSuccess]}>
              {statusMsg.type === 'success' ? '✓ ' : '⚠ '}{statusMsg.text}
            </Text>
          </View>
        )}

        {/* Abo-Pläne */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Abo-Pläne</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openNewPlan} activeOpacity={0.7}>
              <Text style={styles.addBtnText}>+ Neuer Plan</Text>
            </TouchableOpacity>
          </View>

          {subscriptionPlans.length === 0 ? (
            <Text style={styles.empty}>Noch keine Abo-Pläne angelegt.</Text>
          ) : (
            subscriptionPlans.map(p => (
              <View key={p.id} style={styles.planRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planDetails}>
                    {p.ems_credits_per_month}x EMS · {p.lymph_credits_per_month}x Lymph · {p.monthly_price.toFixed(2)} €/Monat
                  </Text>
                  <Text style={styles.planExtra}>
                    Extra: {p.extra_ems_price.toFixed(2)} € EMS · {p.extra_lymph_price.toFixed(2)} € Lymph
                  </Text>
                </View>
                <View style={styles.planBtns}>
                  <TouchableOpacity style={styles.planEditBtn} onPress={() => openEditPlan(p)} activeOpacity={0.7}>
                    <Text style={styles.planEditBtnText}>Bearbeiten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.planDeleteBtn} onPress={() => onDeletePlan(p.id)} activeOpacity={0.7}>
                    <Text style={styles.planDeleteBtnText}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {showPlanForm && (
            <View style={styles.planForm}>
              <Text style={styles.planFormTitle}>{editingPlan ? 'Plan bearbeiten' : 'Neuer Abo-Plan'}</Text>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput style={styles.input} value={planName} onChangeText={setPlanName} placeholder="z.B. EMS 1x/Woche" placeholderTextColor="#9CA3AF" />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>EMS/Monat</Text>
                  <TextInput style={styles.input} value={planEms} onChangeText={setPlanEms} placeholder="4" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Lymph/Monat</Text>
                  <TextInput style={styles.input} value={planLymph} onChangeText={setPlanLymph} placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
                </View>
              </View>
              <Text style={styles.fieldLabel}>Monatspreis (€) *</Text>
              <TextInput style={styles.input} value={planPrice} onChangeText={setPlanPrice} placeholder="79.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Extra EMS (€)</Text>
                  <TextInput style={styles.input} value={planExtraEms} onChangeText={setPlanExtraEms} placeholder="25.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Extra Lymph (€)</Text>
                  <TextInput style={styles.input} value={planExtraLymph} onChangeText={setPlanExtraLymph} placeholder="20.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
                </View>
              </View>
              <Text style={styles.fieldLabel}>Rabatt-Preis Lymph (€)</Text>
              <TextInput style={styles.input} value={planDiscountedLymph} onChangeText={setPlanDiscountedLymph} placeholder="15.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
              {planError && <Text style={styles.fieldError}>{planError}</Text>}
              <View style={styles.formBtns}>
                <TouchableOpacity style={[styles.saveBtn, planLoading && { opacity: 0.6 }]} onPress={savePlan} disabled={planLoading} activeOpacity={0.7}>
                  <Text style={styles.saveBtnText}>{planLoading ? 'Speichern...' : 'Plan speichern'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPlanForm(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Monatsabrechnung */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monatsabrechnung · SEPA-Lastschrift</Text>

          <Text style={styles.fieldLabel}>Abrechnungszeitraum (YYYY-MM)</Text>
          <TextInput style={styles.input} value={period} onChangeText={setPeriod} placeholder="2026-05" placeholderTextColor="#9CA3AF" />

          <Text style={styles.fieldLabel}>Fälligkeitsdatum (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={collectionDate} onChangeText={setCollectionDate} placeholder="2026-05-01" placeholderTextColor="#9CA3AF" />

          <View style={styles.billingBtns}>
            <TouchableOpacity
              style={[styles.billingBtn, billingLoading && { opacity: 0.5 }]}
              onPress={runBilling}
              activeOpacity={0.7}
              disabled={billingLoading}
            >
              <Text style={styles.billingBtnText}>{billingLoading ? 'Abrechnen...' : '⚡ Monat abrechnen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.autoFillBtn, autoFillLoading && { opacity: 0.5 }]}
              onPress={autoFillCharges}
              activeOpacity={0.7}
              disabled={autoFillLoading}
            >
              <Text style={styles.autoFillBtnText}>{autoFillLoading ? 'Laden...' : '↓ Beträge auto-befüllen'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.billingHint}>
            1. "Monat abrechnen" → legt Abo-Charges und Guthaben an{'\n'}
            2. "Beträge auto-befüllen" → lädt alle offenen Positionen{'\n'}
            3. Prüfen und SEPA-XML herunterladen
          </Text>
        </View>

        {/* Warnung: fehlende SEPA-Daten */}
        {customers.filter(c => c.is_active && !(c.iban && c.mandate_reference)).length > 0 && (
          <View style={[styles.card, styles.warnCard]}>
            <Text style={styles.warnTitle}>⚠ Kunden ohne vollständige SEPA-Daten</Text>
            {customers.filter(c => c.is_active && !(c.iban && c.mandate_reference)).map(c => (
              <Text key={c.id} style={styles.warnItem}>· {c.full_name} (#{c.customer_number})</Text>
            ))}
          </View>
        )}

        {/* Beträge (auto-befüllt oder manuell) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Beträge</Text>
          {sepaCustomers.length === 0 ? (
            <Text style={styles.empty}>Keine Kunden mit vollständigen SEPA-Daten.</Text>
          ) : (
            sepaCustomers.map(c => {
              const breakdown = chargeBreakdown[c.id];
              const isExpanded = expandedCustomer === c.id;
              return (
                <View key={c.id}>
                  <View style={styles.customerRow}>
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{c.full_name}</Text>
                      <Text style={styles.customerSub}>#{c.customer_number} · {c.iban?.slice(-4).padStart(c.iban?.length ?? 4, '·')}</Text>
                    </View>
                    {breakdown && (
                      <TouchableOpacity onPress={() => setExpandedCustomer(isExpanded ? null : c.id)} activeOpacity={0.7} style={styles.breakdownToggle}>
                        <Text style={styles.breakdownToggleText}>{isExpanded ? '▲' : '▼'} {breakdown.length} Pos.</Text>
                      </TouchableOpacity>
                    )}
                    <TextInput
                      style={styles.amountInput}
                      value={charges[c.id] ?? ''}
                      onChangeText={v => setCharges(prev => ({ ...prev, [c.id]: v }))}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.euro}>€</Text>
                  </View>
                  {isExpanded && breakdown && (
                    <View style={styles.breakdownList}>
                      {breakdown.map(ch => (
                        <View key={ch.id} style={styles.breakdownItem}>
                          <Text style={styles.breakdownDesc} numberOfLines={2}>{ch.description}</Text>
                          <Text style={styles.breakdownAmount}>{ch.amount.toFixed(2)} €</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {chargesWithAmount.length > 0 && (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {chargesWithAmount.length} Kunden · Gesamt: <Text style={styles.summaryAmount}>{totalAmount.toFixed(2)} €</Text>
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.generateBtn, (generating || chargesWithAmount.length === 0) && { opacity: 0.5 }]}
          onPress={generateAndDownload}
          activeOpacity={0.7}
          disabled={generating || chargesWithAmount.length === 0}
        >
          <Text style={styles.generateBtnText}>{generating ? 'Wird erstellt...' : '📄 SEPA-XML erstellen & herunterladen'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { padding: 32, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 32, paddingBottom: 40 },
  statusBox: { borderRadius: 12, padding: 14, marginBottom: 16 },
  statusSuccess: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC' },
  statusError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusTextSuccess: { color: '#15803D' },
  statusTextError: { color: '#DC2626' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  addBtn: { backgroundColor: 'rgba(90,140,106,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#5A8C6A' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', outlineWidth: 0 } as any,
  twoCol: { flexDirection: 'row', gap: 12 },
  // Pläne
  planRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  planName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  planDetails: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  planExtra: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  planBtns: { gap: 6 },
  planEditBtn: { backgroundColor: 'rgba(90,140,106,0.1)', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  planEditBtnText: { fontSize: 12, fontWeight: '700', color: '#5A8C6A' },
  planDeleteBtn: { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  planDeleteBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  planForm: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, marginTop: 12 },
  planFormTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 4 },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#5A8C6A', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  fieldError: { fontSize: 13, color: '#EF4444', fontWeight: '600', marginTop: 8 },
  // Abrechnung
  billingBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  billingBtn: { flex: 1, backgroundColor: '#5A8C6A', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  billingBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  autoFillBtn: { flex: 1, backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  autoFillBtnText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
  billingHint: { fontSize: 12, color: '#9CA3AF', marginTop: 12, lineHeight: 18 },
  warnCard: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  warnTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  warnItem: { fontSize: 13, color: '#B45309', marginBottom: 3 },
  empty: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 20 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  customerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  amountInput: { width: 90, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'right', outlineWidth: 0 } as any,
  euro: { fontSize: 15, fontWeight: '700', color: '#374151' },
  breakdownToggle: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 4 },
  breakdownToggleText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  breakdownList: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, marginBottom: 4, gap: 6 },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  breakdownDesc: { flex: 1, fontSize: 12, color: '#374151' },
  breakdownAmount: { fontSize: 12, fontWeight: '700', color: '#111827' },
  summary: { backgroundColor: 'rgba(90,140,106,0.08)', borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center' },
  summaryText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  summaryAmount: { color: '#5A8C6A', fontWeight: '800' },
  generateBtn: { backgroundColor: '#5A8C6A', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
