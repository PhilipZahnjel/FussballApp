import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CustomerProfile, AdminAppointment } from '../hooks/useAdminData';
import { LEVEL_COLORS, LEVEL_LABELS, PlayerLevel } from '../../types';

interface Props {
  customers: CustomerProfile[];
  allAppointments: AdminAppointment[];
  loading: boolean;
  onSelectCustomer: (id: string) => void;
  onCreateCustomer: (params: { email: string; full_name: string; phone: string; birth_date: string; address: string }) => Promise<{ error: string | null; tempPassword?: string; customerNumber?: number }>;
}

export function KundenScreen({ customers, allAppointments, loading, onSelectCustomer, onCreateCustomer }: Props) {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formBirth, setFormBirth] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{ name: string; email: string; password: string; number: number } | null>(null);

  const resetForm = () => {
    setFormEmail(''); setFormName(''); setFormPhone('');
    setFormBirth(''); setFormAddress('');
    setFormError(null); setShowForm(false);
  };

  const doCreate = async () => {
    if (!formEmail.trim() || !formName.trim()) {
      setFormError('Name und E-Mail sind Pflichtfelder.');
      return;
    }
    setFormError(null);
    setFormLoading(true);
    try {
      const { error, tempPassword, customerNumber } = await onCreateCustomer({
        email: formEmail.trim(),
        full_name: formName.trim(),
        phone: formPhone.trim(),
        birth_date: formBirth.trim(),
        address: formAddress.trim(),
      });
      if (error) {
        setFormError(error);
      } else {
        setCreatedInfo({ name: formName.trim(), email: formEmail.trim(), password: tempPassword!, number: customerNumber! });
        resetForm();
      }
    } finally {
      setFormLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c =>
      (c.full_name ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      String(c.customer_number).includes(q)
    );
  }, [customers, query]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#5A8C6A" />;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Kunden</Text>
        <Text style={styles.count}>{customers.length} gesamt</Text>
      </View>

      {createdInfo && (
        <View style={styles.successBox}>
          <View style={styles.successHeader}>
            <Text style={styles.successTitle}>✓ Kunde #{createdInfo.number} angelegt</Text>
            <TouchableOpacity onPress={() => setCreatedInfo(null)} activeOpacity={0.7}>
              <Text style={styles.successClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.successLine}>{createdInfo.name} · {createdInfo.email}</Text>
          <Text style={styles.successPwLabel}>Temporäres Passwort — bitte dem Kunden mitteilen:</Text>
          <View style={styles.passwordBox}>
            <Text style={styles.passwordText} selectable>{createdInfo.password}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.newBtn} onPress={() => { setShowForm(v => !v); setCreatedInfo(null); }} activeOpacity={0.7}>
        <Text style={styles.newBtnText}>{showForm ? '✕ Abbrechen' : '+ Neuen Kunden anlegen'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Neuen Kunden anlegen</Text>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Max Mustermann" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>E-Mail *</Text>
              <TextInput style={styles.input} value={formEmail} onChangeText={setFormEmail} placeholder="max@beispiel.de" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Telefon</Text>
              <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="0170 1234567" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Geburtsdatum (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={formBirth} onChangeText={setFormBirth} placeholder="1990-01-15" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Adresse</Text>
          <TextInput style={styles.input} value={formAddress} onChangeText={setFormAddress} placeholder="Musterstraße 1, 12345 Musterstadt" placeholderTextColor="#9CA3AF" />
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={[styles.submitBtn, formLoading && { opacity: 0.6 }]} onPress={doCreate} activeOpacity={0.7} disabled={formLoading}>
            <Text style={styles.submitBtnText}>{formLoading ? 'Wird angelegt...' : 'Kunden anlegen'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Name, E-Mail, Telefon oder Kundennummer..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filtered.length === 0 && (
          <Text style={styles.empty}>Keine Kunden gefunden.</Text>
        )}
        {filtered.map(c => {
          const apptCount = allAppointments.filter(a => a.user_id === c.id && a.status === 'confirmed').length;
          return (
            <TouchableOpacity
              key={c.id}
              style={styles.row}
              onPress={() => onSelectCustomer(c.id)}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(c.full_name ?? '?').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{c.full_name ?? '—'}</Text>
                  {c.level && (
                    <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLORS[c.level as PlayerLevel] + '22', borderColor: LEVEL_COLORS[c.level as PlayerLevel] }]}>
                      <Text style={[styles.levelBadgeText, { color: LEVEL_COLORS[c.level as PlayerLevel] }]}>
                        {LEVEL_LABELS[c.level as PlayerLevel]}
                      </Text>
                    </View>
                  )}
                  {!c.is_active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>Inaktiv</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sub}>{c.email ?? '—'} · {c.phone ?? '—'}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.customerNr}>#{c.customer_number}</Text>
                <Text style={styles.apptCount}>{apptCount} Termine</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 32, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  count: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 32,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', outlineWidth: 0 } as any,
  clearIcon: { fontSize: 14, color: '#9CA3AF', paddingHorizontal: 4 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 32, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(90,140,106,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#5A8C6A' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  levelBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  levelBadgeText: { fontSize: 11, fontWeight: '700' },
  inactiveBadge: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  sub: { fontSize: 13, color: '#6B7280' },
  right: { alignItems: 'flex-end', gap: 3 },
  customerNr: { fontSize: 13, fontWeight: '700', color: '#5A8C6A' },
  apptCount: { fontSize: 12, color: '#9CA3AF' },
  chevron: { fontSize: 22, color: '#D1D5DB', fontWeight: '300', marginLeft: 4 },
  newBtn: {
    marginHorizontal: 32, marginBottom: 16,
    backgroundColor: '#5A8C6A', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  newBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  form: {
    marginHorizontal: 32, marginBottom: 20,
    backgroundColor: '#fff', borderRadius: 14, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  formRow: { flexDirection: 'row', gap: 14, marginBottom: 0 },
  formField: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#111827', outlineWidth: 0,
  } as any,
  submitBtn: {
    marginTop: 20, backgroundColor: '#5A8C6A',
    borderRadius: 10, paddingVertical: 13, alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  formError: { fontSize: 13, color: '#EF4444', fontWeight: '600', marginTop: 12 },
  successBox: {
    marginHorizontal: 32, marginBottom: 16,
    backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC',
    borderRadius: 14, padding: 18,
  },
  successHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  successTitle: { fontSize: 15, fontWeight: '800', color: '#15803D' },
  successClose: { fontSize: 16, color: '#6B7280', fontWeight: '600', paddingHorizontal: 4 },
  successLine: { fontSize: 13, color: '#374151', marginBottom: 12 },
  successPwLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  passwordBox: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#86EFAC',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
  },
  passwordText: { fontSize: 22, fontWeight: '800', color: '#15803D', letterSpacing: 2, textAlign: 'center' },
});
