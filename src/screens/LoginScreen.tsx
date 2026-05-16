import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { supabase } from '../lib/supabase';

interface Props {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const doLogin = async () => {
    if (!email.includes('@')) { setErr('Bitte eine gültige E-Mail-Adresse eingeben.'); return; }
    if (pw.length < 4) { setErr('Passwort zu kurz.'); return; }
    setErr('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) {
      setErr('E-Mail oder Passwort falsch.');
    } else {
      onLogin();
    }
  };

  const emailErr = !!err && !email.includes('@');
  const pwErr = !!err && pw.length < 4;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 44, paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Brand Header */}
          <View style={styles.brand}>
            <View style={styles.logoBadge}>
              <Text style={styles.badgeEmoji}>⚽</Text>
            </View>
            <Text style={styles.studioName}>PK-Fußballschule</Text>
            <Text style={styles.studioCity}>Hattersheim am Main</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Willkommen zurück</Text>
            <Text style={styles.formSub}>Melde dich an, um deine Termine zu verwalten.</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>E-Mail-Adresse</Text>
              <TextInput
                style={[styles.input, emailErr && styles.inputErr]}
                value={email}
                onChangeText={v => { setEmail(v); setErr(''); }}
                placeholder="anna@beispiel.de"
                placeholderTextColor={C.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.fieldWrap, { marginBottom: err ? 8 : 28 }]}>
              <Text style={styles.fieldLabel}>Passwort</Text>
              <TextInput
                style={[styles.input, pwErr && styles.inputErr]}
                value={pw}
                onChangeText={v => { setPw(v); setErr(''); }}
                placeholder="••••••••"
                placeholderTextColor={C.textFaint}
                secureTextEntry
              />
            </View>

            {!!err && <Text style={styles.errText}>{err}</Text>}

            <TouchableOpacity
              onPress={doLogin}
              disabled={loading}
              activeOpacity={0.88}
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            >
              <Text style={styles.loginBtnLabel}>
                {loading ? 'Wird angemeldet…' : 'Anmelden'}
              </Text>
              {!loading && <Text style={styles.loginBtnArrow}>→</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
            <Text style={styles.forgotLabel}>Passwort vergessen?</Text>
          </TouchableOpacity>

          {/* Decorative elements */}
          <View style={styles.decorRow}>
            <View style={styles.decorLine} />
            <Text style={styles.decorText}>PK Fußballschule · Buchungs-App</Text>
            <View style={styles.decorLine} />
          </View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  badgeEmoji: { fontSize: 42 },
  studioName: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  studioCity: {
    fontSize: 14,
    color: C.textFaint,
    marginTop: 5,
    letterSpacing: 0.1,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    marginBottom: 16,
    shadowColor: '#152238',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 7,
    borderWidth: 1,
    borderColor: 'rgba(21,34,56,0.06)',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  formSub: {
    fontSize: 14,
    color: C.textFaint,
    marginBottom: 28,
    lineHeight: 20,
  },
  fieldWrap: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textMid,
    marginBottom: 8,
    letterSpacing: 0.02,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(21,34,56,0.14)',
    backgroundColor: '#F7FAFD',
    color: C.text,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  inputErr: {
    borderColor: C.red,
    backgroundColor: 'rgba(220,38,38,0.04)',
  },
  errText: {
    fontSize: 13,
    color: C.red,
    fontWeight: '600',
    marginBottom: 16,
  },
  loginBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 7,
  },
  loginBtnLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  loginBtnArrow: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 22,
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 32,
  },
  forgotLabel: {
    fontSize: 14,
    color: C.textFaint,
    fontWeight: '500',
  },
  decorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  decorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(21,34,56,0.10)',
  },
  decorText: {
    fontSize: 11,
    color: C.textFaint,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
