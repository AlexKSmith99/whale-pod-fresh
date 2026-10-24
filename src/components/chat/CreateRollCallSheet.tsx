import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, TextInput,
  ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';
import { rollCallService } from '../../services/rollCallService';

interface Props {
  visible: boolean;
  pursuitId: string;
  currentUserId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Mode = 'meeting' | 'date';

function formatWhen(d: Date): string {
  return d.toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** Next half-hour boundary, so the default is a sane time rather than 6:43. */
function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30);
  return d;
}

/**
 * Sheet for calling a roll call. Two routes, matching where the answers end up
 * (see rollCallService): point at a meeting that already exists, or propose a
 * date that doesn't.
 */
export default function CreateRollCallSheet({
  visible, pursuitId, currentUserId, onClose, onCreated,
}: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  const accent = isNewTheme ? colors.accentGreen : editorial.carolina;
  const onAccent = isNewTheme ? colors.background : '#FFFFFF';
  const border = isNewTheme ? colors.border : editorial.hairline;
  const headerFont = isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold';
  const bodyFont = isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold';

  const [mode, setMode] = useState<Mode>('date');
  const [meetings, setMeetings] = useState<{ id: string; title: string; scheduledTime: string }[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [when, setWhen] = useState<Date>(nextHalfHour());
  const [showPicker, setShowPicker] = useState<null | 'date' | 'time'>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // reset each time it opens
    setNote('');
    setWhen(nextHalfHour());
    setSelectedMeetingId(null);
    setShowPicker(null);

    let cancelled = false;
    setLoadingMeetings(true);
    rollCallService.upcomingMeetings(pursuitId).then(list => {
      if (cancelled) return;
      setMeetings(list);
      // Default to whichever route is actually useful: if the pod has an
      // upcoming meeting, asking about that is the common case.
      if (list.length > 0) {
        setMode('meeting');
        setSelectedMeetingId(list[0].id);
      } else {
        setMode('date');
      }
      setLoadingMeetings(false);
    });
    return () => { cancelled = true; };
  }, [visible, pursuitId]);

  const canSubmit = mode === 'meeting' ? !!selectedMeetingId : when.getTime() > Date.now();

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const id = await rollCallService.create({
      pursuitId,
      createdBy: currentUserId,
      ...(mode === 'meeting'
        ? { meetingId: selectedMeetingId! }
        : { proposedTime: when.toISOString() }),
      note,
    });
    setSubmitting(false);
    if (id) {
      onCreated();
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: isNewTheme ? 'rgba(0,0,0,0.7)' : 'rgba(27,27,24,0.55)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: border }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.title, { color: colors.textPrimary, fontFamily: headerFont }]}>Roll call</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.6} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.blurb, { color: colors.textSecondary, fontFamily: bodyFont }]}>
            Ask the pod who's coming. Everyone gets one question: in, or out.
          </Text>

          {/* route toggle */}
          <View style={[styles.segment, { borderColor: border }]}>
            {(['meeting', 'date'] as Mode[]).map(m => {
              const on = mode === m;
              const disabled = m === 'meeting' && meetings.length === 0;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.segmentBtn, on && { backgroundColor: accent }]}
                  activeOpacity={0.8}
                  disabled={disabled}
                  onPress={() => setMode(m)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: on ? onAccent : disabled ? colors.disabledText : colors.textSecondary,
                        fontFamily: bodyFont,
                      },
                    ]}
                  >
                    {m === 'meeting' ? 'A meeting' : 'A new date'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {mode === 'meeting' ? (
              loadingMeetings ? (
                <ActivityIndicator style={{ marginVertical: 24 }} color={accent} />
              ) : meetings.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textTertiary, fontFamily: bodyFont }]}>
                  No upcoming meetings on this pod's calendar. Propose a new date instead.
                </Text>
              ) : (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: bodyFont }]}>
                    WHICH MEETING
                  </Text>
                  {meetings.map(m => {
                    const on = selectedMeetingId === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.option,
                          { borderColor: on ? accent : border, backgroundColor: on ? (isNewTheme ? 'rgba(200,255,107,0.1)' : editorial.carolinaTint) : 'transparent' },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setSelectedMeetingId(m.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionTitle, { color: colors.textPrimary, fontFamily: bodyFont }]} numberOfLines={1}>
                            {m.title}
                          </Text>
                          <Text style={[styles.optionMeta, { color: colors.textTertiary, fontFamily: bodyFont }]}>
                            {formatWhen(new Date(m.scheduledTime))}
                          </Text>
                        </View>
                        {on && <Ionicons name="checkmark-circle" size={20} color={accent} />}
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={[styles.hint, { color: colors.textTertiary, fontFamily: bodyFont }]}>
                    Answers update everyone's calendar, so this doubles as the meeting RSVP.
                  </Text>
                </>
              )
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: bodyFont }]}>
                  WHEN
                </Text>
                <View style={styles.dateRow}>
                  <TouchableOpacity
                    style={[styles.dateBtn, { borderColor: border }]}
                    activeOpacity={0.7}
                    onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}
                  >
                    <Ionicons name="calendar-outline" size={16} color={accent} />
                    <Text style={[styles.dateText, { color: colors.textPrimary, fontFamily: bodyFont }]}>
                      {when.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateBtn, { borderColor: border }]}
                    activeOpacity={0.7}
                    onPress={() => setShowPicker(showPicker === 'time' ? null : 'time')}
                  >
                    <Ionicons name="time-outline" size={16} color={accent} />
                    <Text style={[styles.dateText, { color: colors.textPrimary, fontFamily: bodyFont }]}>
                      {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showPicker && (
                  <DateTimePicker
                    value={when}
                    mode={showPicker}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={showPicker === 'date' ? new Date() : undefined}
                    themeVariant={isNewTheme ? 'dark' : 'light'}
                    onChange={(_, picked) => {
                      if (Platform.OS !== 'ios') setShowPicker(null);
                      if (!picked) return;
                      // Keep the half we aren't editing — the picker returns a
                      // whole Date for either mode.
                      const next = new Date(when);
                      if (showPicker === 'date') {
                        next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                      } else {
                        next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                      }
                      setWhen(next);
                    }}
                  />
                )}

                <Text style={[styles.hint, { color: colors.textTertiary, fontFamily: bodyFont }]}>
                  Nothing goes on the calendar yet. Once people are in, you can add it.
                </Text>
              </>
            )}

            <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: bodyFont, marginTop: 20 }]}>
              ANYTHING TO ADD
            </Text>
            <TextInput
              style={[
                styles.noteInput,
                {
                  borderColor: border,
                  color: colors.textPrimary,
                  backgroundColor: isNewTheme ? colors.background : editorial.surface,
                  fontFamily: bodyFont,
                },
              ]}
              placeholder="Optional — e.g. bring a headlamp"
              placeholderTextColor={colors.textTertiary}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={140}
            />
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.submit,
              { backgroundColor: canSubmit ? accent : colors.disabled },
            ]}
            activeOpacity={0.85}
            disabled={!canSubmit || submitting}
            onPress={submit}
          >
            {submitting ? (
              <ActivityIndicator color={onAccent} />
            ) : (
              <Text style={[styles.submitText, { color: canSubmit ? onAccent : colors.disabledText, fontFamily: bodyFont }]}>
                Post roll call
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, letterSpacing: -0.5 },
  blurb: { fontSize: 13.5, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 9999, padding: 3, gap: 3 },
  segmentBtn: { flex: 1, height: 38, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 12.5, letterSpacing: 0.3 },
  scroll: { marginTop: 18 },
  fieldLabel: { fontSize: 10, letterSpacing: 0.9, marginBottom: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  optionTitle: { fontSize: 14 },
  optionMeta: { fontSize: 11.5, marginTop: 2 },
  empty: { fontSize: 13, lineHeight: 20, marginVertical: 18 },
  hint: { fontSize: 11.5, lineHeight: 17, marginTop: 10 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 48, borderWidth: 1, borderRadius: 12,
  },
  dateText: { fontSize: 13.5 },
  noteInput: {
    borderWidth: 1, borderRadius: 14, padding: 14,
    fontSize: 14, minHeight: 72, textAlignVertical: 'top',
  },
  submit: { height: 54, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  submitText: { fontSize: 15, letterSpacing: 0.2 },
});
