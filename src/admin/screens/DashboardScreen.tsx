import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CustomerProfile, AdminAppointment, ConsultationRequest } from '../hooks/useAdminData';
import { PROGRAMS } from '../../constants/programs';

const PROGRAM_COLORS: Record<string, string> = {
  muscle: '#4A8FE8', lymph: '#3DBFA0', relax: '#F5A84A', metabolism: '#E87676', consultation: '#8B5CF6',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekEnd() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(ds: string) {
  const [y, m, d] = ds.split('-');
  return `${d}.${m}.${y}`;
}

interface Props {
  customers: CustomerProfile[];
  allAppointments: AdminAppointment[];
  consultationRequests: ConsultationRequest[];
  loading: boolean;
  onUpdateConsultation: (id: string, status: 'confirmed' | 'cancelled') => Promise<{ error: any }>;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function DashboardScreen({ customers, allAppointments, consultationRequests, loading, onUpdateConsultation }: Props) {
  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#5A8C6A" />;

  const ts = todayStr();
  const we = weekEnd();

  const todayAppts = allAppointments.filter(a => a.date === ts && a.status === 'confirmed');
  const weekAppts = allAppointments.filter(a => a.date >= ts && a.date <= we && a.status === 'confirmed');
  const activeCustomers = customers.filter(c => c.is_active);
  const upcoming = allAppointments
    .filter(a => a.date >= ts && a.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 10);

  const pendingConsultations = consultationRequests
    .filter(c => c.status === 'pending' && c.date >= ts)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.statsRow}>
        <StatCard label="Aktive Kunden" value={activeCustomers.length} color="#5A8C6A" />
        <StatCard label="Heute" value={todayAppts.length} color="#4A8FE8" />
        <StatCard label="Diese Woche" value={weekAppts.length} color="#F5A84A" />
        <StatCard label="Anfragen offen" value={pendingConsultations.length} color="#8B5CF6" />
      </View>

      {/* Beratungsanfragen */}
      {pendingConsultations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Beratungsanfragen
            <Text style={styles.pendingBadge}> {pendingConsultations.length} offen</Text>
          </Text>
          {pendingConsultations.map(c => (
            <View key={c.id} style={styles.consultCard}>
              <View style={styles.consultLeft}>
                <View style={styles.consultDot} />
                <View style={styles.consultInfo}>
                  <Text style={styles.consultName}>{c.name}</Text>
                  <Text style={styles.consultMeta}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</Text>
                  {c.message ? <Text style={styles.consultMessage} numberOfLines={2}>{c.message}</Text> : null}
                </View>
              </View>
              <View style={styles.consultRight}>
                <Text style={styles.consultDate}>{fmtDate(c.date)}</Text>
                <Text style={styles.consultTime}>{c.time} Uhr</Text>
                <View style={styles.consultBtns}>
                  <TouchableOpacity
                    style={styles.consultConfirmBtn}
                    onPress={() => onUpdateConsultation(c.id, 'confirmed')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.consultConfirmText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.consultCancelBtn}
                    onPress={() => onUpdateConsultation(c.id, 'cancelled')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.consultCancelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Nächste Termine</Text>
      {upcoming.length === 0 ? (
        <Text style={styles.empty}>Keine bevorstehenden Termine.</Text>
      ) : (
        upcoming.map(a => {
          const customer = customers.find(c => c.id === a.user_id);
          const prog = PROGRAMS.find(p => p.id === a.program);
          const color = PROGRAM_COLORS[a.program] ?? '#5A8C6A';
          return (
            <View key={a.id} style={styles.apptRow}>
              <View style={[styles.colorDot, { backgroundColor: color }]} />
              <View style={styles.apptInfo}>
                <Text style={styles.apptName}>{customer?.full_name ?? '—'}</Text>
                <Text style={styles.apptMeta}>{prog?.name ?? a.program}</Text>
              </View>
              <Text style={styles.apptDate}>{fmtDate(a.date)} · {a.time} Uhr</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  content: { padding: 32 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 36, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 120, backgroundColor: '#fff', borderRadius: 14,
    padding: 20, shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  pendingBadge: { fontSize: 13, fontWeight: '600', color: '#8B5CF6' },
  // Beratungsanfragen
  consultCard: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: '#8B5CF6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  consultLeft: { flexDirection: 'row', gap: 10, flex: 1 },
  consultDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6', marginTop: 5 },
  consultInfo: { flex: 1 },
  consultName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  consultMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  consultMessage: { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  consultRight: { alignItems: 'flex-end', gap: 4, marginLeft: 12 },
  consultDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  consultTime: { fontSize: 12, color: '#6B7280' },
  consultBtns: { flexDirection: 'row', gap: 6, marginTop: 4 },
  consultConfirmBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  consultConfirmText: { fontSize: 14, fontWeight: '800', color: '#15803D' },
  consultCancelBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  consultCancelText: { fontSize: 14, fontWeight: '800', color: '#DC2626' },
  // Termine
  empty: { color: '#9CA3AF', fontSize: 14, paddingVertical: 20, textAlign: 'center' },
  apptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  apptInfo: { flex: 1 },
  apptName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  apptMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  apptDate: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
});
