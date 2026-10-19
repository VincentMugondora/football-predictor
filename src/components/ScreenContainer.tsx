import React, { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface ScreenContainerProps {
  children: React.ReactNode;
}

export function ScreenContainer({ children }: ScreenContainerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.pitchBackdrop} pointerEvents="none">
        <View style={styles.pitchStripe} />
        <View style={styles.pitchStripeAlt} />
        <View style={styles.pitchStripe} />
        <View style={styles.pitchStripeAlt} />
        <View style={styles.pitchStripe} />
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    pitchBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      flexDirection: 'row',
    },
    pitchStripe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    pitchStripeAlt: {
      flex: 1,
      backgroundColor: theme.colors.pitchStripe,
    },
    keyboardView: {
      flex: 1,
    },
    inner: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
    },
  });
}
