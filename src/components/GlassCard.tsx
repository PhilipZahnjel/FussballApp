import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function GlassCard({ children, style }: Props) {
  return (
    <View style={[styles.card, StyleSheet.flatten(style)]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#152238',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 5,
  },
});
