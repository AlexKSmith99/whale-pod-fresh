/**
 * KeyboardAwareScreen — THE app-wide rule for text input + keyboard.
 *
 * Every screen (or modal body) that contains a TextInput renders its content
 * inside this component. It guarantees: when any input inside is focused,
 * the view scrolls so the WHOLE input — and the text being typed — sits
 * above the keyboard. Powered by react-native-keyboard-controller
 * (KeyboardProvider is mounted at the app root).
 *
 * THEME RULE: this wrapper NEVER hardcodes a background color. By default it
 * is transparent so the screen's own background shows through. If the screen
 * needs the wrapper itself to paint the surface, pass the theme token
 * explicitly via `backgroundColor` (e.g. theme.colors.background) — never a
 * literal hex.
 *
 * ── Prop API ──────────────────────────────────────────────────────────────
 * mode="scroll" (default)
 *   Content becomes scrollable (KeyboardAwareScrollView under the hood).
 *   Use when the screen does NOT already have its own ScrollView — this
 *   replaces the need for one. Style scroll content via
 *   `contentContainerStyle`, e.g. paddings.
 *
 * mode="replace-scrollview"
 *   Semantically identical to "scroll" — alias provided so call sites read
 *   clearly when you're swapping an existing <ScrollView> for this wrapper.
 *   Carry over the old ScrollView's props (contentContainerStyle,
 *   refreshControl, showsVerticalScrollIndicator, ...) — they're all
 *   forwarded.
 *
 * mode="pinned"
 *   NO scrolling. For non-scrolling layouts where something is pinned to
 *   the bottom (chat composers, bottom-sheet forms, login CTA stacks).
 *   Children render in a flex:1 column that shrinks above the keyboard
 *   (KeyboardAvoidingView behavior, but keyboard-controller-accurate).
 *
 * Common props (all modes):
 *   bottomOffset      gap kept between the focused input's bottom edge and
 *                     the keyboard (default 24; bump to ~90 on screens with
 *                     a floating bar above the keyboard).
 *   backgroundColor   optional THEME TOKEN for the wrapper surface.
 *                     Defaults to transparent — see THEME RULE above.
 *   style / contentContainerStyle / ...ScrollViewProps  forwarded.
 *
 * Examples:
 *   // New screen, no scroll container yet:
 *   <KeyboardAwareScreen contentContainerStyle={{ padding: 20 }}>
 *     ...inputs...
 *   </KeyboardAwareScreen>
 *
 *   // Migrating an existing ScrollView:
 *   <KeyboardAwareScreen mode="replace-scrollview"
 *     contentContainerStyle={oldProps} refreshControl={...}>
 *
 *   // Chat composer / bottom sheet:
 *   <KeyboardAwareScreen mode="pinned">
 *     <MessagesList />
 *     <Composer />
 *   </KeyboardAwareScreen>
 */
import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';
import type { ScrollViewProps } from 'react-native';

export interface KeyboardAwareScreenProps extends ScrollViewProps {
  children?: React.ReactNode;
  /** 'scroll' (default) | 'replace-scrollview' (alias) | 'pinned' (no scroll) */
  mode?: 'scroll' | 'replace-scrollview' | 'pinned';
  /** Gap between the focused input's bottom edge and the keyboard. */
  bottomOffset?: number;
  /**
   * Whether keyboard-controller's auto-scroll is active for this instance
   * (default true). Set false on screens where the wrapper is nested inside
   * another ScrollView (e.g. a horizontal pager) and you instead rely on
   * iOS `automaticallyAdjustKeyboardInsets` — keyboard-controller's
   * parentScrollViewTarget check no-ops in that nesting.
   */
  enabled?: boolean;
  /** Optional THEME token (never a hardcoded hex). Default: transparent. */
  backgroundColor?: string;
  /** Outer container style (in addition to flex:1 + backgroundColor). */
  style?: StyleProp<ViewStyle>;
}

export default function KeyboardAwareScreen({
  children,
  mode = 'scroll',
  bottomOffset = 24,
  backgroundColor,
  style,
  ...scrollProps
}: KeyboardAwareScreenProps) {
  const surface = backgroundColor ? { backgroundColor } : null;

  if (mode === 'pinned') {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={[styles.flex, surface, style]}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  // 'scroll' and 'replace-scrollview' are the same behavior — the alias
  // exists so migration call sites self-document.
  return (
    <KeyboardAwareScrollView
      bottomOffset={bottomOffset}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      style={[styles.flex, surface, style]}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
});

// Re-exported so chat-style screens can pin a composer to the keyboard's top
// edge without inventing their own mechanism (still "one roof").
export { KeyboardStickyView } from 'react-native-keyboard-controller';
