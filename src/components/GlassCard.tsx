import React from 'react';
import { View, ViewStyle, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { C } from '../constants/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function GlassCard({ children, style }: Props) {
  const base: ViewStyle = {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  };

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={55} tint="light" style={[base, StyleSheet.flatten(style)]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.10)' }]} pointerEvents="none" />
        {children}
      </BlurView>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[base, { backgroundColor: C.glass }, StyleSheet.flatten(style)] as any}
        // @ts-ignore web-only style
        dataSet={undefined}
      >
        <View
          style={[StyleSheet.absoluteFill, { borderRadius: 20 }] as any}
          // @ts-ignore
          pointerEvents="none"
        />
        {children}
      </View>
    );
  }

  return (
    <View style={[base, { backgroundColor: 'rgba(255,255,255,0.22)' }, StyleSheet.flatten(style)]}>
      {children}
    </View>
  );
}
