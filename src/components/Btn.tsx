import React, { useRef } from 'react';
import { TouchableOpacity, Text, ViewStyle, Animated, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

type Variant = 'primary' | 'ghost' | 'red';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Btn({ label, onPress, variant = 'primary', disabled = false, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isPrim = variant === 'primary';
  const isRed = variant === 'red';

  const pressIn = () => Animated.timing(scale, { toValue: 0.985, duration: 80, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        activeOpacity={1}
        style={[
          styles.btn,
          isPrim && styles.prim,
          isRed && styles.red,
          !isPrim && !isRed && styles.ghost,
          disabled && { opacity: 0.45 },
        ]}
      >
        <Text style={[styles.label, (isPrim || isRed) && { color: '#fff' }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prim: {
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  red: {
    backgroundColor: C.red,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.33,
    shadowRadius: 8,
    elevation: 4,
  },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  label: {
    color: C.textGlass,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});
