import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { CustomerProfile, AdminAppointment } from '../hooks/useAdminData';
import { PROGRAMS } from '../../constants/programs';

const PROGRAM_COLORS: Record<string, string> = {
  individual: '#4A8FE8', gruppe: '#3DBFA0', athletik: '#F5A84A',
  torhueter_individual: '#E87676', torhueter_gruppe: '#9B59B6',
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
  loading: boolean;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function DashboardScreen({ customers, allAppointments, loading }: Props) {
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.statsRow}>
        <StatCard label="Aktive Spieler" value={activeCustomers.length} color="#5A8C6A" />
        <StatCard label="Heute" value={todayAppts.length} color="#4A8FE8" />
        <StatCard label="Diese Woche" value={weekAppts.length} color="#F5A84A" />
      </View>

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
