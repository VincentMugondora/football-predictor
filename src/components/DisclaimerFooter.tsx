import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export const COMPLIANCE_DISCLAIMER_TEXT =
  'Estimates, not advice. Only bet money you can afford to lose.';

export function DisclaimerFooter() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.footer} accessible={true} accessibilityRole="text">
      <Text style={styles.text}>{COMPLIANCE_DISCLAIMER_TEXT}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    footer: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      marginTop: theme.spacing.lg,
      alignItems: 'center',
    },
    text: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.caption,
      lineHeight: theme.typography.lineHeights.caption,
      textAlign: 'center',
    },
  });
}
