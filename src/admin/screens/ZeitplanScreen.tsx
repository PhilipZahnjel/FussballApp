import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { TrainerSchedule, TrainerSpecialty } from '../../types';
import { TrainerProfile } from '../hooks/useAdminData';
import { SLOTS } from '../../constants/slots';

const DAYS: { label: string; value: number }[] = [
  { label: 'Mo', value: 1 },
  { label: 'Di', value: 2 },
  { label: 'Mi', value: 3 },
  { label: 'Do', value: 4 },
  { label: 'Fr', value: 5 },
];

const SPECIALTY_LABEL: Record<TrainerSpecialty, string> = {
  spieler: 'Spieler',
  torwart: 'Torwart',
};

const SPECIALTY_COLOR: Record<TrainerSpecialty, string> = {
  spieler: '#4A8FE8',
  torwart: '#9B59B6',
};

interface Props {
  trainers: TrainerProfile[];
  trainerSchedules: TrainerSchedule[];
  onToggleSlot: (trainerId: string, day: number, time: string) => Promise<{ error: unknown }>;
  onCreateTrainer: (params: { full_name: string; email: string; specialty: TrainerSpecialty }) => Promise<{ error: string | null; tempPassword?: string }>;
}

export function ZeitplanScreen({ trainers, trainerSchedules, onToggleSlot, onCreateTrainer }: Props) {
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(
    trainers.length > 0 ? trainers[0].id : null,
  );
  const [toggling, setToggling] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSpecialty, setFormSpecialty] = useState<TrainerSpecialty>('spieler');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const selectedTrainer = trainers.find(t => t.id === selectedTrainerId) ?? null;

  const isActive = (day: number, time: string) =>
    trainerSchedules.some(
      s => s.trainer_id === selectedTrainerId && s.day_of_week === day && s.time === time,
    );

  const handleToggle = async (day: number, time: string) => {
    if (!selectedTrainerId) return;
    const key = `${day}-${time}`;
    setToggling(key);
    await onToggleSlot(selectedTrainerId, day, time);
    setToggling(null);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Name und E-Mail sind Pflicht.');
      return;
    }
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);
    const { error, tempPassword } = await onCreateTrainer({
      full_name: formName.trim(),
      email: formEmail.trim(),
      specialty: formSpecialty,
    });
    setFormLoading(false);
    if (error) {
      setFormError(error);
    } else {
      setFormSuccess(`Trainer angelegt. Temporäres Passwort: ${tempPassword}`);
      setFormName('');
      setFormEmail('');
      setFormSpecialty('spieler');
      setShowForm(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trainerzeitplan</Text>

      {/* Trainer-Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {trainers.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.chip, selectedTrainerId === t.id && styles.chipActive]}
            onPress={() => setSelectedTrainerId(t.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipName, selectedTrainerId === t.id && styles.chipNameActive]}>
              {t.full_name}
            </Text>
            {t.trainer_specialty && (
              <View style={[styles.specialtyBadge, { backgroundColor: SPECIALTY_COLOR[t.trainer_specialty] }]}>
                <Text style={styles.specialtyBadgeText}>{SPECIALTY_LABEL[t.trainer_specialty]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, styles.chipAdd]}
          onPress={() => { setShowForm(v => !v); setFormError(null); setFormSuccess(null); }}
          activeOpacity={0.7}
        >
          <Text style={styles.chipAddText}>+ Trainer anlegen</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Formular */}
      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Neuen Trainer anlegen</Text>
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={formName}
            onChangeText={setFormName}
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            placeholder="E-Mail"
            value={formEmail}
            onChangeText={setFormEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
          <View style={styles.specialtyRow}>
            {(['spieler', 'torwart'] as TrainerSpecialty[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.specialtyBtn, formSpecialty === s && { backgroundColor: SPECIALTY_COLOR[s] }]}
                onPress={() => setFormSpecialty(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.specialtyBtnText, formSpecialty === s && styles.specialtyBtnTextActive]}>
                  {SPECIALTY_LABEL[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {formError && <Text style={styles.errorText}>{formError}</Text>}
          {formLoading
            ? <ActivityIndicator style={{ marginTop: 8 }} color="#5A8C6A" />
            : (
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} activeOpacity={0.8}>
                <Text style={styles.submitBtnText}>Anlegen</Text>
              </TouchableOpacity>
            )
          }
        </View>
      )}

      {formSuccess && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{formSuccess}</Text>
        </View>
      )}

      {/* Wochenraster */}
      {selectedTrainer ? (
        <View style={styles.grid}>
          {/* Header */}
          <View style={styles.gridRow}>
            <View style={styles.timeCell} />
            {DAYS.map(d => (
              <View key={d.value} style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{d.label}</Text>
              </View>
            ))}
          </View>

          {/* Slots */}
          {SLOTS.map(time => (
            <View key={time} style={styles.gridRow}>
              <View style={styles.timeCell}>
                <Text style={styles.timeCellText}>{time}</Text>
              </View>
              {DAYS.map(d => {
                const active = isActive(d.value, time);
                const key = `${d.value}-${time}`;
                const loading = toggling === key;
                return (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.cell, active ? styles.cellActive : styles.cellInactive]}
                    onPress={() => handleToggle(d.value, time)}
                    activeOpacity={0.7}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={active ? '#fff' : '#5A8C6A'} />
                      : <Text style={[styles.cellDot, active ? styles.cellDotActive : styles.cellDotInactive]}>
                          {active ? '●' : '○'}
                        </Text>
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Noch keine Trainer vorhanden.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  content: { padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#1C2133', marginBottom: 16 },

  chipRow: { flexDirection: 'row', marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.5, borderColor: '#E0E0E0', marginRight: 8 },
  chipActive: { borderColor: '#5A8C6A', backgroundColor: '#F0F7F2' },
  chipName: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipNameActive: { color: '#5A8C6A' },
  specialtyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  specialtyBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  chipAdd: { borderStyle: 'dashed', borderColor: '#5A8C6A' },
  chipAddText: { fontSize: 13, fontWeight: '600', color: '#5A8C6A' },

  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E8ECF0' },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#1C2133', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#DDE2E8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#1C2133', marginBottom: 10 },
  specialtyRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  specialtyBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#DDE2E8', alignItems: 'center' },
  specialtyBtnText: { fontSize: 13, fontWeight: '600', color: '#666' },
  specialtyBtnTextActive: { color: '#fff' },
  errorText: { color: '#DC2626', fontSize: 13, marginBottom: 8 },
  submitBtn: { backgroundColor: '#5A8C6A', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  successBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 8, padding: 12, marginBottom: 16 },
  successText: { color: '#15803D', fontSize: 13, fontWeight: '600' },

  grid: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E8ECF0' },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  timeCell: { width: 60, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, backgroundColor: '#F8FAFB' },
  timeCellText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  dayHeader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, backgroundColor: '#F8FAFB' },
  dayHeaderText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  cell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  cellActive: { backgroundColor: '#F0F7F2' },
  cellInactive: { backgroundColor: '#fff' },
  cellDot: { fontSize: 18 },
  cellDotActive: { color: '#5A8C6A' },
  cellDotInactive: { color: '#D1D5DB' },

  emptyText: { color: '#9CA3AF', fontSize: 14, marginTop: 24, textAlign: 'center' },
});
