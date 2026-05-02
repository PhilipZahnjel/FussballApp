import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(ds: string) {
  const [y, m, d] = ds.split('-');
  return `${d}.${m}.${y}`;
}

type TrainerAppointment = {
  id: string;
  date: string;
  time: string;
  status: string;
  program: string;
  user_id: string;
};

interface Props {
  onLogout: () => void;
}

export function TrainerApp({ onLogout }: Props) {
  const [appointments, setAppointments] = useState<TrainerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainerName, setTrainerName] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: appts }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase.from('appointments')
          .select('id, date, time, status, program, user_id')
          .eq('trainer_id', user.id)
          .eq('status', 'confirmed')
          .gte('date', todayStr())
          .order('date')
          .order('time'),
      ]);

      setTrainerName(profile?.full_name ?? 'Trainer');
      setAppointments((appts ?? []) as TrainerAppointment[]);
      setLoading(false);
    };
    load();
  }, []);

  const ts = todayStr();
  const todayAppts = appointments.filter(a => a.date === ts);
  const upcomingAppts = appointments.filter(a => a.date > ts);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Trainer-Bereich</Text>
          <Text style={styles.headerTitle}>{trainerName}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#4A7FD4" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Heute ({todayAppts.length})</Text>
          {todayAppts.length === 0 ? (
            <Text style={styles.empty}>Keine Trainings heute.</Text>
          ) : (
            todayAppts.map(a => <ApptCard key={a.id} appt={a} />)
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Bevorstehend ({upcomingAppts.length})</Text>
          {upcomingAppts.length === 0 ? (
            <Text style={styles.empty}>Keine weiteren Trainings.</Text>
          ) : (
            upcomingAppts.map(a => <ApptCard key={a.id} appt={a} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ApptCard({ appt }: { appt: TrainerAppointment }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardProgram}>{appt.program}</Text>
        <Text style={styles.cardDate}>{fmtDate(appt.date)} · {appt.time} Uhr</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    backgroundColor: '#1C2133',
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  logoutText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  content: { padding: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  empty: { fontSize: 14, color: '#9CA3AF', paddingVertical: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: { flex: 1 },
  cardProgram: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardDate: { fontSize: 13, color: '#6B7280' },
});
