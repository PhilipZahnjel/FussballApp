import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { GlassCard } from '../components/GlassCard';
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
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <GlassCard style={styles.logoCard}>
              <Text style={styles.logoIcon}>⚡</Text>
            </GlassCard>
            <Text style={styles.studioName}>Muster EMS Studio</Text>
            <Text style={styles.studioCity}>Musterstadt</Text>
          </View>

          {/* Form */}
          <GlassCard style={styles.formCard}>
            <Text style={styles.formTitle}>Anmelden</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>E-Mail-Adresse</Text>
              <TextInput
                style={[styles.input, emailErr && styles.inputErr]}
                value={email}
                onChangeText={v => { setEmail(v); setErr(''); }}
                placeholder="anna@beispiel.de"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.fieldWrap, { marginBottom: err ? 8 : 24 }]}>
              <Text style={styles.fieldLabel}>Passwort</Text>
              <TextInput
                style={[styles.input, pwErr && styles.inputErr]}
                value={pw}
                onChangeText={v => { setPw(v); setErr(''); }}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
              />
            </View>

            {!!err && <Text style={styles.errText}>{err}</Text>}

            <TouchableOpacity
              onPress={doLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            >
              <Text style={styles.loginBtnLabel}>
                {loading ? 'Wird angemeldet…' : 'Anmelden'}
              </Text>
            </TouchableOpacity>
          </GlassCard>

          <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
            <Text style={styles.forgotLabel}>Passwort vergessen?</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCard: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 32,
    textAlign: 'center',
    paddingVertical: 16,
  },
  studioName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  studioCity: {
    fontSize: 14,
    color: C.textFaint,
    marginTop: 4,
  },
  formCard: {
    padding: 28,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 24,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textFaint,
    marginBottom: 8,
    letterSpacing: 0.04,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
  },
  inputErr: {
    borderColor: C.red,
  },
  errText: {
    fontSize: 13,
    color: C.red,
    fontWeight: '600',
    marginBottom: 16,
  },
  loginBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtnLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotLabel: {
    fontSize: 14,
    color: C.textFaint,
  },
});
