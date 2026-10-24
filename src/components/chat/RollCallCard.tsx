import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';
import type { RollCall, RollCallAnswer } from '../../services/rollCallService';
import { initialOf } from '../../utils/displayName';

interface Props {
  rollCall: RollCall;
  currentUserId: string;
  /** Pod creator gets the close/promote actions even if someone else called it. */
  isPodCreator?: boolean;
  busy?: boolean;
  onAnswer: (answer: RollCallAnswer) => void;
  onClose?: () => void;
  onPromote?: () => void;
  onOpenMeeting?: (meetingId: string) => void;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Time TBD';
  const d = new Date(iso);
  const today = new Date();
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * A roll call as it appears in the pod chat stream.
 *
 * Rendered as a full-width card rather than a message bubble on purpose: it
 * belongs to the group rather than to its author, and the IN/OUT controls need
 * a tap target that a bubble can't give them.
 */
export default function RollCallCard({
  rollCall: rc,
  currentUserId,
  isPodCreator,
  busy,
  onAnswer,
  onClose,
  onPromote,
  onOpenMeeting,
}: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  const accent = isNewTheme ? colors.accentGreen : editorial.carolina;
  const onAccent = isNewTheme ? colors.background : '#FFFFFF';
  const surface = isNewTheme ? colors.surface : editorial.surface;
  const border = isNewTheme ? colors.border : editorial.hairline;
  const headerFont = isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold';
  const bodyFont = isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold';

  const isOpen = rc.status === 'open';
  const canManage = rc.createdBy === currentUserId || !!isPodCreator;
  const inList = rc.responders.filter(r => r.answer === 'in');
  const outList = rc.responders.filter(r => r.answer === 'out');

  const tally = [
    `${rc.inCount} in`,
    `${rc.outCount} out`,
    ...(rc.pendingCount > 0 && isOpen ? [`${rc.pendingCount} yet to say`] : []),
  ].join('  ·  ');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor: border,
          // Editorial cards carry a 3px accent stripe down the left edge; the
          // dark theme uses a flat surface with no stripe.
          borderLeftWidth: isNewTheme ? 1 : 3,
          borderLeftColor: isNewTheme ? border : accent,
          borderRadius: isNewTheme ? 16 : 14,
        },
        !isNewTheme && styles.cardShadow,
      ]}
    >
      {/* label + who called it */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="hand-left-outline" size={13} color={accent} />
          <Text style={[styles.label, { color: accent, fontFamily: bodyFont }]}>ROLL CALL</Text>
        </View>
        {rc.status === 'closed' && (
          <Text style={[styles.statusWord, { color: colors.textTertiary, fontFamily: bodyFont }]}>CLOSED</Text>
        )}
        {rc.status === 'promoted' && (
          <Text style={[styles.statusWord, { color: accent, fontFamily: bodyFont }]}>ON THE CALENDAR</Text>
        )}
      </View>

      {/* the time being asked about */}
      <Text style={[styles.when, { color: colors.textPrimary, fontFamily: headerFont }]}>
        {formatWhen(rc.time)}
      </Text>

      <Text style={[styles.context, { color: colors.textTertiary, fontFamily: bodyFont }]}>
        {rc.isMeetingBacked
          ? rc.meetingTitle || 'Already on the calendar'
          : 'Not on the calendar yet'}
        {'  ·  '}
        {rc.createdBy === currentUserId ? 'you asked' : `${rc.createdByName} asked`}
      </Text>

      {rc.note ? (
        <Text style={[styles.note, { color: colors.textSecondary, fontFamily: bodyFont }]}>{rc.note}</Text>
      ) : null}

      {/* IN / OUT */}
      {isOpen ? (
        <View style={styles.answers}>
          {(['in', 'out'] as RollCallAnswer[]).map(answer => {
            const picked = rc.myAnswer === answer;
            const isIn = answer === 'in';
            return (
              <TouchableOpacity
                key={answer}
                style={[
                  styles.answerBtn,
                  {
                    backgroundColor: picked ? (isIn ? accent : colors.surfaceAlt) : 'transparent',
                    borderColor: picked ? (isIn ? accent : colors.textTertiary) : border,
                  },
                ]}
                activeOpacity={0.85}
                disabled={busy}
                onPress={() => onAnswer(answer)}
                accessibilityRole="button"
                accessibilityState={{ selected: picked }}
                accessibilityLabel={isIn ? "I'm in" : "I'm out"}
              >
                {busy && picked ? (
                  <ActivityIndicator size="small" color={picked && isIn ? onAccent : colors.textSecondary} />
                ) : (
                  <Text
                    style={[
                      styles.answerText,
                      {
                        color: picked ? (isIn ? onAccent : colors.textPrimary) : colors.textSecondary,
                        fontFamily: bodyFont,
                      },
                    ]}
                  >
                    {isIn ? "I'M IN" : "I'M OUT"}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* who answered */}
      {rc.responders.length > 0 && (
        <View style={styles.rosterRow}>
          <View style={styles.stack}>
            {inList.slice(0, 5).map((r, i) => (
              <View
                key={r.userId}
                style={[
                  styles.stackItem,
                  { marginLeft: i === 0 ? 0 : -9, borderColor: surface, zIndex: 10 - i },
                ]}
              >
                {r.profilePicture ? (
                  <Image source={{ uri: r.profilePicture }} style={styles.stackImage} />
                ) : (
                  <View style={[styles.stackImage, styles.stackFallback, { backgroundColor: accent }]}>
                    <Text style={[styles.stackLetter, { color: onAccent }]}>{initialOf(r)}</Text>
                  </View>
                )}
              </View>
            ))}
            {inList.length > 5 && (
              <View style={[styles.stackItem, styles.stackMore, { marginLeft: -9, borderColor: surface, backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.stackLetter, { color: colors.textSecondary }]}>+{inList.length - 5}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.tally, { color: colors.textTertiary, fontFamily: bodyFont }]}>{tally}</Text>
        </View>
      )}

      {rc.responders.length === 0 && (
        <Text style={[styles.tally, styles.tallyAlone, { color: colors.textTertiary, fontFamily: bodyFont }]}>
          Nobody's answered yet
        </Text>
      )}

      {/* names, so "who" doesn't require tapping an avatar */}
      {inList.length > 0 && (
        <Text style={[styles.names, { color: colors.textSecondary, fontFamily: bodyFont }]} numberOfLines={2}>
          <Text style={{ color: accent }}>In: </Text>
          {inList.map(r => (r.userId === currentUserId ? 'You' : r.name)).join(', ')}
        </Text>
      )}
      {outList.length > 0 && (
        <Text style={[styles.names, { color: colors.textTertiary, fontFamily: bodyFont }]} numberOfLines={2}>
          Out: {outList.map(r => (r.userId === currentUserId ? 'You' : r.name)).join(', ')}
        </Text>
      )}

      {/* author / leader actions */}
      {canManage && isOpen && (
        <View style={[styles.actions, { borderTopColor: border }]}>
          {!rc.isMeetingBacked && rc.inCount > 0 && onPromote && (
            <TouchableOpacity style={styles.action} activeOpacity={0.6} onPress={onPromote} disabled={busy}>
              <Ionicons name="calendar-outline" size={14} color={accent} />
              <Text style={[styles.actionText, { color: accent, fontFamily: bodyFont }]}>Add to calendar</Text>
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity style={styles.action} activeOpacity={0.6} onPress={onClose} disabled={busy}>
              <Ionicons name="close-circle-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.actionText, { color: colors.textTertiary, fontFamily: bodyFont }]}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* jump to the meeting this produced, or the one it's about */}
      {(rc.promotedMeetingId || rc.meetingId) && onOpenMeeting && (
        <TouchableOpacity
          style={[styles.actions, styles.singleAction, { borderTopColor: border }]}
          activeOpacity={0.6}
          onPress={() => onOpenMeeting((rc.promotedMeetingId || rc.meetingId)!)}
        >
          <Ionicons name="open-outline" size={14} color={accent} />
          <Text style={[styles.actionText, { color: accent, fontFamily: bodyFont }]}>View meeting</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginVertical: 8, padding: 16, paddingLeft: 18, borderWidth: 1 },
  cardShadow: {
    shadowColor: '#1B1B18',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, letterSpacing: 1.1 },
  statusWord: { fontSize: 9, letterSpacing: 0.9 },
  when: { fontSize: 19, letterSpacing: -0.3, marginBottom: 4 },
  context: { fontSize: 11, marginBottom: 2 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  answers: { flexDirection: 'row', gap: 10, marginTop: 14 },
  answerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: { fontSize: 12.5, letterSpacing: 0.8 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  stack: { flexDirection: 'row' },
  stackItem: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, overflow: 'hidden' },
  stackImage: { width: '100%', height: '100%' },
  stackFallback: { alignItems: 'center', justifyContent: 'center' },
  stackMore: { alignItems: 'center', justifyContent: 'center' },
  stackLetter: { fontSize: 10, fontWeight: '700' },
  tally: { fontSize: 11, flex: 1 },
  tallyAlone: { marginTop: 14 },
  names: { fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  singleAction: { marginTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 11.5 },
});
