import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { TrainerProfile } from '../hooks/useAdminData';

type TrainerVideo = {
  id: string;
  trainer_id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
};

interface Props {
  trainers: TrainerProfile[];
}

export function TrainerVideosScreen({ trainers }: Props) {
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(
    trainers.length > 0 ? trainers[0].id : null,
  );
  const [videos, setVideos] = useState<TrainerVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTrainerId) return;
    setLoadingVideos(true);
    supabase
      .from('trainer_videos')
      .select('id, trainer_id, title, url, description, created_at')
      .eq('trainer_id', selectedTrainerId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVideos((data ?? []) as TrainerVideo[]);
        setLoadingVideos(false);
      });
  }, [selectedTrainerId]);

  const handleAddVideo = async () => {
    setFormError(null);
    if (!formTitle.trim()) { setFormError('Bitte einen Titel eingeben.'); return; }
    if (!formUrl.trim()) { setFormError('Bitte eine URL eingeben.'); return; }
    if (!selectedTrainerId) return;

    setFormLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('trainer_videos')
      .insert({
        trainer_id: selectedTrainerId,
        title: formTitle.trim(),
        url: formUrl.trim(),
        description: formDesc.trim() || null,
        created_by: user?.id ?? null,
      })
      .select('id, trainer_id, title, url, description, created_at')
      .single();
    setFormLoading(false);
    if (error) { setFormError(error.message); return; }
    if (data) {
      setVideos(prev => [data as TrainerVideo, ...prev]);
      setFormTitle('');
      setFormUrl('');
      setFormDesc('');
      setShowForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    const { error } = await supabase.from('trainer_videos').delete().eq('id', id);
    if (error) { setDeleteError(error.message); return; }
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const selectedTrainer = trainers.find(t => t.id === selectedTrainerId);

  return (
    <View style={styles.root}>
      {/* Trainer-Sidebar */}
      <View style={styles.trainerList}>
        <Text style={styles.trainerListTitle}>Trainer</Text>
        {trainers.length === 0 && (
          <Text style={styles.emptyTrainers}>Keine Trainer vorhanden.</Text>
        )}
        {trainers.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.trainerItem, selectedTrainerId === t.id && styles.trainerItemActive]}
            onPress={() => { setSelectedTrainerId(t.id); setShowForm(false); setDeleteError(null); }}
            activeOpacity={0.7}
          >
            <View style={styles.trainerAvatar}>
              <Text style={styles.trainerAvatarText}>
                {t.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <Text style={[styles.trainerName, selectedTrainerId === t.id && styles.trainerNameActive]} numberOfLines={1}>
              {t.full_name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Video-Bereich */}
      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        {selectedTrainer ? (
          <>
            <View style={styles.mainHeader}>
              <View>
                <Text style={styles.mainTitle}>Videos – {selectedTrainer.full_name}</Text>
                <Text style={styles.mainSub}>{videos.length} {videos.length === 1 ? 'Video' : 'Videos'}</Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { setShowForm(v => !v); setFormError(null); }}
                activeOpacity={0.7}
              >
                <Text style={styles.addBtnText}>{showForm ? '✕ Abbrechen' : '+ Video hinzufügen'}</Text>
              </TouchableOpacity>
            </View>

            {showForm && (
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>Titel *</Text>
                <TextInput
                  style={styles.input}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="z.B. Dribbling-Übung"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.fieldLabel}>URL *</Text>
                <TextInput
                  style={styles.input}
                  value={formUrl}
                  onChangeText={setFormUrl}
                  placeholder="https://youtube.com/..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
                <Text style={styles.fieldLabel}>Beschreibung (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={formDesc}
                  onChangeText={setFormDesc}
                  placeholder="Kurze Beschreibung..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                />
                {formError && <Text style={styles.fieldError}>{formError}</Text>}
                <TouchableOpacity
                  style={[styles.saveBtn, formLoading && { opacity: 0.6 }]}
                  onPress={handleAddVideo}
                  disabled={formLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.saveBtnText}>{formLoading ? 'Hinzufügen...' : 'Video hinzufügen'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {deleteError && <Text style={styles.fieldError}>{deleteError}</Text>}

            {loadingVideos ? (
              <ActivityIndicator color="#4A7FD4" style={{ marginTop: 40 }} />
            ) : videos.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🎬</Text>
                <Text style={styles.emptyText}>Noch keine Videos für diesen Trainer.</Text>
                <Text style={styles.emptyHint}>Klicke auf „+ Video hinzufügen" um loszulegen.</Text>
              </View>
            ) : (
              videos.map(v => (
                <View key={v.id} style={styles.videoCard}>
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle}>{v.title}</Text>
                    {v.description && <Text style={styles.videoDesc}>{v.description}</Text>}
                    <Text style={styles.videoUrl} numberOfLines={1}>{v.url}</Text>
                  </View>
                  <View style={styles.videoActions}>
                    <TouchableOpacity
                      style={styles.openBtn}
                      onPress={() => Linking.openURL(v.url)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.openBtnText}>Öffnen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(v.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteBtnText}>Löschen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Bitte links einen Trainer auswählen.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#F4F6F9' },

  trainerList: { width: 220, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#E5E7EB', padding: 16 },
  trainerListTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  emptyTrainers: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  trainerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, marginBottom: 4 },
  trainerItemActive: { backgroundColor: 'rgba(74,127,212,0.1)' },
  trainerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1C2133', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trainerAvatarText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  trainerName: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1, minWidth: 0 },
  trainerNameActive: { color: '#4A7FD4', fontWeight: '700' },

  main: { flex: 1 },
  mainContent: { padding: 32, paddingBottom: 60 },
  mainHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  mainTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  mainSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  addBtn: { backgroundColor: 'rgba(74,127,212,0.1)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#4A7FD4' },

  form: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', outlineWidth: 0 } as any,
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  fieldError: { fontSize: 13, color: '#EF4444', fontWeight: '600', marginTop: 10 },
  saveBtn: { backgroundColor: '#4A7FD4', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#9CA3AF' },

  videoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  videoInfo: { flex: 1, minWidth: 0 },
  videoTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  videoDesc: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  videoUrl: { fontSize: 12, color: '#9CA3AF' },
  videoActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  openBtn: { backgroundColor: 'rgba(74,127,212,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  openBtnText: { fontSize: 13, fontWeight: '700', color: '#4A7FD4' },
  deleteBtn: { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
