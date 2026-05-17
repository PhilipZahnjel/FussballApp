import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

function getStyles(C: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.glass,
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
}

export function GlassCard({ children, style }: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => getStyles(C), [C]);
  return (
    <View style={[styles.card, StyleSheet.flatten(style)]}>
      {children}
    </View>
  );
}
