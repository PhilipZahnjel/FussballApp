import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { Tab } from '../types';

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
}

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? C.accentLight : 'rgba(255,255,255,0.4)';
  return (
    <View style={[styles.icon, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={[styles.houseRoof, { borderBottomColor: c }]} />
      <View style={[styles.houseBody, { borderColor: c }]} />
    </View>
  );
}

function TermineIcon({ active }: { active: boolean }) {
  const c = active ? C.accentLight : 'rgba(255,255,255,0.4)';
  return (
    <View style={styles.icon}>
      {[0, 4, 8].map(y => (
        <View key={y} style={[styles.line, { marginTop: y === 0 ? 0 : 3, width: y === 8 ? 16 : 24, backgroundColor: c }]} />
      ))}
    </View>
  );
}


function ProfilIcon({ active }: { active: boolean }) {
  const c = active ? C.accentLight : 'rgba(255,255,255,0.4)';
  return (
    <View style={[styles.icon, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={[styles.head, { borderColor: c }]} />
      <View style={[styles.shoulders, { borderColor: c }]} />
    </View>
  );
}

const MAIN_ITEMS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'termine', label: 'Termine' },
  { id: 'profil', label: 'Profil' },
];

export function BottomNav({ tab, setTab }: Props) {
  const insets = useSafeAreaInsets();
  const pb = Math.max(insets.bottom, 16);
  const navStyle = [styles.nav, { paddingBottom: pb }];

  if (tab === 'buchen') {
    return (
      <View style={navStyle}>
        <TouchableOpacity style={styles.item} onPress={() => setTab('home')}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.itemLabelInactive}>Abbrechen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={() => setTab('home')}>
          <HomeIcon active={false} />
          <Text style={styles.itemLabelInactive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={() => setTab('profil')}>
          <ProfilIcon active={false} />
          <Text style={styles.itemLabelInactive}>Profil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={navStyle}>
      {MAIN_ITEMS.map(({ id, label }) => {
        const active = tab === id;
        const labelStyle = active ? styles.itemLabelActive : styles.itemLabelInactive;
        return (
          <TouchableOpacity key={id} style={styles.item} onPress={() => setTab(id)}>
            {id === 'home' && <HomeIcon active={active} />}
            {id === 'termine' && <TermineIcon active={active} />}
            {id === 'profil' && <ProfilIcon active={active} />}
            <Text style={labelStyle}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    backgroundColor: C.navBg,
    borderTopWidth: 1,
    borderTopColor: C.navBorder,
    paddingTop: 10,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } as any : {}),
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  icon: { width: 24, height: 24, justifyContent: 'center' },
  line: { height: 2, borderRadius: 1 },
  houseRoof: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginBottom: 1 },
  houseBody: { width: 13, height: 9, borderWidth: 1.8, borderRadius: 1 },
  head: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.8, marginBottom: 2 },
  shoulders: { width: 16, height: 7, borderWidth: 1.8, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomWidth: 0 },
  backArrow: { fontSize: 20, color: 'rgba(255,255,255,0.5)', lineHeight: 24 },
  itemLabelActive: { fontSize: 10, fontWeight: '700', color: C.accentLight, letterSpacing: 0.05 },
  itemLabelInactive: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.05 },
});
