import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function getStyles(C: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.cardBorder,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#152238',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
  });
}

export function Card({ children, style }: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => getStyles(C), [C]);
  return (
    <View style={[styles.card, StyleSheet.flatten(style)]}>
      {children}
    </View>
  );
}
