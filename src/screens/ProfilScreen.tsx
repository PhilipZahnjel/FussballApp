import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Easing, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { GlassCard } from '../components/GlassCard';
import { Card } from '../components/Card';
import { Btn } from '../components/Btn';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { STUDIO } from '../constants/studio';
import { CancellationToken } from '../types';

interface Props {
  onLogout: () => void;
  activeTokens: CancellationToken[];
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

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '—';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} Jahre`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ProfilScreen({ onLogout, activeTokens }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const { profile, loading } = useProfile();

  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // Erreichbarkeit editieren
  const [editContact, setEditContact] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactMsg, setContactMsg] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (profile?.phone) setEditPhone(profile.phone);
  }, [profile?.phone]);

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
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    }
  };

  const saveContact = async () => {
    setContactLoading(true);
    setContactMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setContactLoading(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({ phone: editPhone.trim() })
      .eq('id', user.id);

    if (!error) {
      // Benachrichtigung an Admin
      await supabase.from('notifications').insert({
        title: 'Kontaktdaten geändert',
        body: `Kunde ${profile?.full_name ?? ''} (Nr. ${profile?.customer_number}) hat seine Telefonnummer geändert auf: ${editPhone.trim()}`,
        is_global: false,
        created_by: user.id,
      });
      setContactMsg('Gespeichert.');
      setEditContact(false);
    } else {
      setContactMsg('Fehler beim Speichern.');
    }
    setContactLoading(false);
  };

  const tokenIndividual = activeTokens.filter(t => t.category === 'individual');
  const tokenGruppe = activeTokens.filter(t => t.category === 'gruppe');

  const playerTypeLabel = profile?.player_type === 'torwart' ? 'Torwart' : profile?.player_type === 'feldspieler' ? 'Feldspieler' : '—';

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
            <Text style={styles.avatarIcon}>
              {profile?.player_type === 'torwart' ? '🧤' : '⚽'}
            </Text>
          </View>
          <Text style={styles.userName}>{loading ? '…' : (profile?.full_name ?? '—')}</Text>
          <Text style={styles.userDetail}>{playerTypeLabel}</Text>
          {profile?.birth_date && (
            <Text style={styles.userDetail}>{calcAge(profile.birth_date)}</Text>
          )}
          {profile?.location && (
            <Text style={styles.userDetail}>📍 {profile.location}</Text>
          )}
          <Text style={styles.userDetail}>Kundennummer: {profile?.customer_number ?? '—'}</Text>
        </GlassCard>

        {/* Erreichbarkeit */}
        <SectionCard title="Erreichbarkeit">
          {editContact ? (
            <View style={styles.editContactForm}>
              <Text style={styles.editLabel}>Telefonnummer</Text>
              <TextInput
                style={styles.editInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="0170 1234567"
                placeholderTextColor="rgba(0,0,0,0.3)"
                keyboardType="phone-pad"
              />
              <Text style={styles.editHint}>E-Mail-Änderungen bitte beim Kundenservice anfragen.</Text>
              {!!contactMsg && (
                <Text style={[styles.contactMsg, { color: contactMsg.startsWith('Fehler') ? C.red : '#15803D' }]}>
                  {contactMsg}
                </Text>
              )}
              <View style={styles.editContactBtns}>
                <TouchableOpacity
                  style={[styles.savePwBtn, { flex: 1 }, contactLoading && { opacity: 0.6 }]}
                  onPress={saveContact}
                  disabled={contactLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.savePwLabel}>{contactLoading ? 'Speichern…' : 'Speichern'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtn, { flex: 1 }]}
                  onPress={() => { setEditContact(false); setContactMsg(''); setEditPhone(profile?.phone ?? ''); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelBtnLabel}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <InfoRow label="Mobil" value={profile?.phone ?? ''} />
              <InfoRow label="E-Mail" value={profile?.email ?? ''} last />
              <View style={styles.editContactRow}>
                <TouchableOpacity
                  style={styles.changePwBtn}
                  onPress={() => setEditContact(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.changePwLabel}>BEARBEITEN</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SectionCard>

        {/* Kontingent / Nachholtermine */}
        {(tokenIndividual.length > 0 || tokenGruppe.length > 0) && (
          <SectionCard title="Nachholtermine">
            {tokenIndividual.length > 0 && (
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Text style={styles.infoKey}>LYMPH (Einzeltraining)</Text>
                <Text style={[styles.infoVal, { color: C.accent }]}>
                  {tokenIndividual.length}x bis {fmtDate(tokenIndividual[0].expires_at.slice(0, 10))}
                </Text>
              </View>
            )}
            {tokenGruppe.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>EMS (Gruppentraining)</Text>
                <Text style={[styles.infoVal, { color: C.accent }]}>
                  {tokenGruppe.length}x bis {fmtDate(tokenGruppe[0].expires_at.slice(0, 10))}
                </Text>
              </View>
            )}
          </SectionCard>
        )}

        {/* Allgemein */}
        <SectionCard title="Allgemein">
          <InfoRow label="Kundennummer" value={profile?.customer_number?.toString() ?? ''} />
          <View style={[styles.infoRow, pwOpen && styles.infoRowBorder]}>
            <Text style={styles.infoKey}>App Passwort</Text>
            <TouchableOpacity
              style={styles.changePwBtn}
              activeOpacity={0.8}
              onPress={() => { setPwOpen(v => !v); setPwErr(''); setPwSuccess(false); }}
            >
              <Text style={styles.changePwLabel}>{pwOpen ? 'ABBRECHEN' : 'ÄNDERN'}</Text>
            </TouchableOpacity>
          </View>
          {pwSuccess && (
            <Text style={styles.pwSuccessMsg}>Passwort erfolgreich geändert.</Text>
          )}
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
                style={[styles.savePwBtn, pwLoading && { opacity: 0.6 }]}
                onPress={changePassword}
                disabled={pwLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.savePwLabel}>{pwLoading ? 'Wird gespeichert…' : 'Speichern'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </SectionCard>

        {/* Studio Kontakt */}
        <SectionCard title="Kontakt">
          <InfoRow label="Büro" value={STUDIO.name} />
          <InfoRow label="Adresse" value={STUDIO.address} />
          <InfoRow label="Telefon" value={STUDIO.phone} />
          <InfoRow label="E-Mail" value={STUDIO.email} />
          <InfoRow label="Erreichbar" value={STUDIO.hours} last />
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
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  userDetail: { fontSize: 14, color: C.textFaint, marginBottom: 2, textAlign: 'center' },
  infoCard: { marginBottom: 14 },
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
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  infoKey: { fontSize: 15, color: C.textMid, flex: 1 },
  infoVal: { fontSize: 15, fontWeight: '600', color: C.text, textAlign: 'right', flex: 1 },
  editContactRow: { paddingHorizontal: 20, paddingVertical: 12 },
  editContactForm: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12 },
  editLabel: { fontSize: 12, fontWeight: '700', color: C.textMid, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  editInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: 'rgba(0,0,0,0.04)',
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  editHint: { fontSize: 12, color: C.textMid, marginBottom: 12 },
  contactMsg: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  editContactBtns: { flexDirection: 'row', gap: 10 },
  changePwBtn: {
    backgroundColor: C.accentBg,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.accent + '44',
  },
  changePwLabel: { fontSize: 13, fontWeight: '700', color: C.accent },
  pwForm: { paddingHorizontal: 20, paddingBottom: 16 },
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
  pwErr: { fontSize: 13, color: C.red, fontWeight: '600', marginTop: 8 },
  pwSuccessMsg: { fontSize: 13, color: '#15803D', fontWeight: '600', paddingHorizontal: 20, paddingBottom: 12 },
  savePwBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePwLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnLabel: { color: C.textMid, fontSize: 16, fontWeight: '600' },
});
