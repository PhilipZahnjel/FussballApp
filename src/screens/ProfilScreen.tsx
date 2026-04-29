import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Easing, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { GlassCard } from '../components/GlassCard';
import { Card } from '../components/Card';
import { Btn } from '../components/Btn';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { STUDIO } from '../constants/studio';

interface Props {
  onLogout: () => void;
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoKey}>{label}</Text>
      <Text style={styles.infoVal}>{value || '—'}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.infoCard}>
      <View style={styles.cardSectionHeader}>
        <Text style={styles.cardSectionLabel}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

export function ProfilScreen({ onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const { profile, loading } = useProfile();

  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwErr, setPwErr] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const changePassword = async () => {
    if (newPw.length < 6) { setPwErr('Mindestens 6 Zeichen.'); return; }
    if (newPw !== confirmPw) { setPwErr('Passwörter stimmen nicht überein.'); return; }
    setPwErr('');
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) {
      setPwErr('Fehler beim Ändern. Bitte erneut versuchen.');
    } else {
      setNewPw('');
      setConfirmPw('');
      setPwOpen(false);
      Alert.alert('Passwort geändert', 'Dein Passwort wurde erfolgreich aktualisiert.');
    }
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: 'transparent' }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 24 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text style={styles.screenTitle}>Profil</Text>

        {/* Avatar */}
        <GlassCard style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <Text style={styles.userName}>{loading ? '…' : (profile?.full_name ?? '—')}</Text>
          {profile?.birth_date ? <Text style={styles.userDetail}>{profile.birth_date}</Text> : null}
          {profile?.address ? <Text style={styles.userDetail}>{profile.address}</Text> : null}
        </GlassCard>

        {/* Erreichbarkeit */}
        <SectionCard title="Erreichbarkeit">
          <InfoRow label="Mobil" value={profile?.phone ?? ''} />
          <InfoRow label="E-Mail" value={profile?.email ?? ''} last />
        </SectionCard>

        {/* Allgemein */}
        <SectionCard title="Allgemein">
          <InfoRow label="Aktiver Kunde" value={profile?.is_active ? 'Ja' : 'Nein'} />
          <InfoRow label="Kundennummer" value={profile?.customer_number?.toString() ?? ''} />
          <View style={[styles.infoRow, pwOpen && styles.infoRowBorder]}>
            <Text style={styles.infoKey}>App Passwort</Text>
            <TouchableOpacity
              style={styles.changePwBtn}
              activeOpacity={0.8}
              onPress={() => { setPwOpen(v => !v); setPwErr(''); }}
            >
              <Text style={styles.changePwLabel}>{pwOpen ? 'ABBRECHEN' : 'ÄNDERN'}</Text>
            </TouchableOpacity>
          </View>
          {pwOpen && (
            <View style={styles.pwForm}>
              <TextInput
                style={styles.pwInput}
                placeholder="Neues Passwort"
                placeholderTextColor="rgba(0,0,0,0.3)"
                secureTextEntry
                value={newPw}
                onChangeText={v => { setNewPw(v); setPwErr(''); }}
              />
              <TextInput
                style={[styles.pwInput, { marginTop: 10 }]}
                placeholder="Passwort bestätigen"
                placeholderTextColor="rgba(0,0,0,0.3)"
                secureTextEntry
                value={confirmPw}
                onChangeText={v => { setConfirmPw(v); setPwErr(''); }}
              />
              {!!pwErr && <Text style={styles.pwErr}>{pwErr}</Text>}
              <TouchableOpacity
                style={[styles.pwSaveBtn, pwLoading && { opacity: 0.6 }]}
                onPress={changePassword}
                disabled={pwLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.pwSaveLabel}>{pwLoading ? 'Wird gespeichert…' : 'Speichern'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </SectionCard>

        {/* Studio Kontakt */}
        <SectionCard title="Kontakt">
          <InfoRow label="Schule" value={STUDIO.name} />
          <InfoRow label="Adresse" value={STUDIO.address} />
          <InfoRow label="Telefon" value={STUDIO.phone} />
          <InfoRow label="E-Mail" value={STUDIO.email} />
          <InfoRow label="Öffnungszeiten" value={STUDIO.hours} last />
        </SectionCard>

        <Btn label="Abmelden" onPress={onLogout} variant="ghost" />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20 },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 24,
  },
  avatarCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarIcon: { fontSize: 38 },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 14,
    color: C.textFaint,
    marginBottom: 2,
    textAlign: 'center',
  },
  infoCard: { marginBottom: 14 },
  creditsRow: { flexDirection: 'row', gap: 12, padding: 16 },
  creditBox: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 14, alignItems: 'center' },
  creditNum: { fontSize: 30, fontWeight: '900' },
  creditLbl: { fontSize: 11, fontWeight: '700', color: C.textMid, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  discountBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  discountBadgeText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  cardSectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMid,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  infoKey: { fontSize: 15, color: C.textMid, flex: 1 },
  infoVal: { fontSize: 15, fontWeight: '600', color: C.text, textAlign: 'right', flex: 1 },
  changePwBtn: {
    backgroundColor: C.accent,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  changePwLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  pwForm: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  pwInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: 'rgba(0,0,0,0.04)',
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  pwErr: {
    fontSize: 13,
    color: C.red,
    fontWeight: '600',
    marginTop: 8,
  },
  pwSaveBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pwSaveLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
