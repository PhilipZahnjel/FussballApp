import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from './src/constants/colors';
import { supabase } from './src/lib/supabase';
import { Tab } from './src/types';
import { useAppointments } from './src/hooks/useAppointments';
import { useProfile } from './src/hooks/useProfile';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { TermineScreen } from './src/screens/TermineScreen';
import { BuchenScreen } from './src/screens/BuchenScreen';
import { ProfilScreen } from './src/screens/ProfilScreen';
import { BottomNav } from './src/components/BottomNav';
import { AdminApp } from './src/admin/AdminApp';

const isWeb = Platform.OS === 'web';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<'admin' | 'customer' | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const { profile } = useProfile();
  const { appointments, myAppointments, activeTokens, addAppointment, cancelAppointment } = useAppointments(profile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
      if (session) fetchRole(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
      if (session) fetchRole(session.user.id);
      else setRole(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    setRole((data?.role as 'admin' | 'customer') ?? 'customer');
  };

  const doLogin = useCallback(() => {}, []);

  const doLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setTab('home');
  }, []);

  // Admin: Vollbild ohne Mobile-Container
  if (loggedIn && role === 'admin') {
    return (
      <SafeAreaProvider>
        <View style={styles.adminRoot}>
          <AdminApp onLogout={doLogout} />
        </View>
      </SafeAreaProvider>
    );
  }

  const appContent = (
    <LinearGradient
      colors={[C.bgTop, C.bgBot]}
      style={styles.gradient}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
    >
      <StatusBar style="light" />

      {!loggedIn ? (
        <LoginScreen onLogin={doLogin} />
      ) : role === null ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <>
          <View style={styles.screens}>
            {tab === 'home' && (
              <HomeScreen appointments={myAppointments} profile={profile} setTab={setTab} />
            )}
            {tab === 'termine' && (
              <TermineScreen appointments={myAppointments} cancelAppointment={cancelAppointment} activeTokens={activeTokens} setTab={setTab} />
            )}
            {tab === 'buchen' && (
              <BuchenScreen key="buchen" appointments={appointments} myAppointments={myAppointments} activeTokens={activeTokens} profile={profile} addAppointment={(d, t, p) => addAppointment(d, t, p)} setTab={setTab} />
            )}
            {tab === 'profil' && (
              <ProfilScreen onLogout={doLogout} />
            )}
          </View>
          <BottomNav tab={tab} setTab={setTab} />
        </>
      )}
    </LinearGradient>
  );

  if (isWeb) {
    return (
      <SafeAreaProvider>
        <View style={styles.webOuter}>
          <View style={styles.webInner}>
            {appContent}
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.nativeRoot}>
        {appContent}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  adminRoot: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  nativeRoot: {
    flex: 1,
    backgroundColor: C.bgTop,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    flex: 1,
  },
  screens: {
    flex: 1,
  },
  webOuter: {
    flex: 1,
    backgroundColor: C.bgBot,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore web-only
    minHeight: '100vh',
  },
  webInner: {
    width: 430,
    flex: 1,
    overflow: 'hidden',
    // @ts-ignore web-only
    maxHeight: '100vh',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.35,
    shadowRadius: 60,
  },
});
