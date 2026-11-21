import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConfidenceLevel } from '@/lib/winnerLabels';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface ConfidenceTagProps {
  level: ConfidenceLevel;
}

const DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  Likely: 'Likely: the pick has a clear lead',
  Lean: 'Lean: the pick is ahead, but not by much',
  'Toss-up': 'Toss-up: too close to call with confidence',
};

/** Plain-language confidence pill: Likely, Lean or Toss-up. */
export function ConfidenceTag({ level }: ConfidenceTagProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, level), [theme, level]);
  return (
    <View style={styles.pill} accessible accessibilityLabel={DESCRIPTIONS[level]}>
      <View style={styles.dot} />
      <Text style={styles.text}>{level}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme, level: ConfidenceLevel) {
  const palette =
    level === 'Likely'
      ? { bg: theme.colors.primaryMuted, fg: theme.colors.primary }
      : level === 'Lean'
        ? { bg: theme.colors.surfaceWarningBanner, fg: theme.colors.warningText }
        : { bg: theme.colors.neutralBarTrack, fg: theme.colors.tossUpText };
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radii.pill,
      backgroundColor: palette.bg,
      alignSelf: 'flex-start',
    },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.fg },
    text: {
      color: palette.fg,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
