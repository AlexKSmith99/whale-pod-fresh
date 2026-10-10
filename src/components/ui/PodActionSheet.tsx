/**
 * PodActionSheet — the overflow ("⋯") menu for a pod detail page.
 *
 * Actions are grouped; each group renders as its own rounded block with
 * hairline dividers between rows, and groups are separated by a gap. A
 * trailing "cancel" block closes the sheet.
 *
 *   - Dark (Pie):        #1F1F1F blocks, barely-there white dividers, Sora.
 *   - Light (editorial): white surface, hairline dividers, ink labels,
 *                        radius 14. Destructive rows use the semantic red.
 *
 * NOTE: several call-site actions open their own native <Modal> (delete
 * confirmation, leave-pod form). A JS overlay cannot stack above an already
 * open Modal, so this sheet dismisses itself BEFORE running an action and
 * defers the callback a frame to let the Modal unmount first.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';

export interface PodAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  /** Rows sharing a group render in one block. Groups render in ascending order. */
  group?: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  actions: PodAction[];
}

export default function PodActionSheet({ visible, onClose, actions }: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      translateY.setValue(40);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 9, tension: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  const dismiss = useCallback(
    (onDone?: () => void) => {
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        onClose();
        // Defer so this Modal is fully unmounted before an action opens another.
        if (onDone) requestAnimationFrame(onDone);
      });
    },
    [onClose, opacity]
  );

  if (!visible) return null;

  const dark = isNewTheme;
  const blockBg = dark ? '#1F1F1F' : '#FFFFFF';
  const divider = dark ? 'rgba(255, 255, 255, 0.10)' : editorial.hairline;
  const labelColor = dark ? '#FFFFFF' : editorial.ink;
  const destructiveColor = dark ? colors.error : editorial.red;
  const labelFont = dark ? 'Sora_600SemiBold' : 'InterTight_600SemiBold';
  const blockRadius = dark ? 18 : 14;

  // Preserve the caller's ordering within each group.
  const groups = actions.reduce<Record<number, PodAction[]>>((acc, action) => {
    const g = action.group ?? 0;
    (acc[g] ||= []).push(action);
    return acc;
  }, {});
  const orderedGroups = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map(g => groups[g]);

  return (
    <Modal transparent statusBarTranslucent visible animationType="none" onRequestClose={() => dismiss()}>
      <Animated.View
        style={[
          styles.backdrop,
          { opacity, backgroundColor: dark ? 'rgba(0,0,0,0.70)' : 'rgba(27,27,24,0.45)' },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss()} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {orderedGroups.map((group, gi) => (
              <View
                key={`group-${gi}`}
                style={[
                  styles.block,
                  { backgroundColor: blockBg, borderRadius: blockRadius },
                  !dark && styles.blockShadowLight,
                  !dark && { borderWidth: 1, borderColor: editorial.hairline },
                ]}
              >
                {group.map((action, ai) => (
                  <TouchableOpacity
                    key={action.key}
                    style={[
                      styles.row,
                      ai > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: divider },
                    ]}
                    activeOpacity={0.6}
                    onPress={() => dismiss(action.onPress)}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                  >
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: action.destructive ? destructiveColor : labelColor, fontFamily: labelFont },
                      ]}
                      numberOfLines={1}
                    >
                      {action.label}
                    </Text>
                    <Ionicons
                      name={action.icon}
                      size={20}
                      color={action.destructive ? destructiveColor : labelColor}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.block,
                styles.cancelBlock,
                { backgroundColor: blockBg, borderRadius: blockRadius },
                !dark && styles.blockShadowLight,
                !dark && { borderWidth: 1, borderColor: editorial.hairline },
              ]}
              activeOpacity={0.6}
              onPress={() => dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.rowLabel, styles.cancelLabel, { color: labelColor, fontFamily: labelFont }]}>
                cancel
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  block: {
    overflow: 'hidden',
    marginTop: 12,
  },
  blockShadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  cancelBlock: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  cancelLabel: {
    flex: 0,
    textAlign: 'center',
  },
});
