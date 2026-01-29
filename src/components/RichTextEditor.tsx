import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Font options
export const FONT_FAMILIES = [
  { label: 'System', value: 'System' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
];

export const FONT_SIZES = [
  { label: 'Small', value: 'small', size: 13 },
  { label: 'Normal', value: 'normal', size: 16 },
  { label: 'Large', value: 'large', size: 20 },
];

export const TEXT_ALIGNMENTS = [
  { icon: 'text-left' as const, value: 'left' },
  { icon: 'text-center' as const, value: 'center' },
  { icon: 'text-right' as const, value: 'right' },
];

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
  fontFamily?: string;
  fontSize?: string;
  onFontFamilyChange?: (family: string) => void;
  onFontSizeChange?: (size: string) => void;
  showToolbar?: boolean;
  autoFocus?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = 150,
  fontFamily = 'System',
  fontSize = 'normal',
  onFontFamilyChange,
  onFontSizeChange,
  showToolbar = true,
  autoFocus = false,
}: RichTextEditorProps) {
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showFontModal, setShowFontModal] = useState(false);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');

  // Get actual font size value
  const getFontSize = () => {
    const sizeConfig = FONT_SIZES.find(s => s.value === fontSize);
    return sizeConfig?.size || 16;
  };

  // Get font family style
  const getFontFamily = () => {
    if (fontFamily === 'System') return undefined;
    return fontFamily;
  };

  // Insert markdown-style formatting
  const insertFormatting = (prefix: string, suffix: string) => {
    const before = value.substring(0, selection.start);
    const selected = value.substring(selection.start, selection.end);
    const after = value.substring(selection.end);

    if (selected) {
      // Wrap selected text
      const newText = before + prefix + selected + suffix + after;
      onChange(newText);
    } else {
      // Insert at cursor
      const newText = before + prefix + suffix + after;
      onChange(newText);
      // Move cursor between markers
      setTimeout(() => {
        inputRef.current?.setNativeProps({
          selection: {
            start: selection.start + prefix.length,
            end: selection.start + prefix.length,
          },
        });
      }, 0);
    }
  };

  const handleBold = () => insertFormatting('**', '**');
  const handleItalic = () => insertFormatting('*', '*');
  const handleUnderline = () => insertFormatting('__', '__');

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      {showToolbar && (
        <View style={styles.toolbar}>
          {/* Formatting buttons */}
          <View style={styles.toolbarSection}>
            <TouchableOpacity style={styles.toolButton} onPress={handleBold}>
              <Text style={styles.toolButtonTextBold}>B</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={handleItalic}>
              <Text style={styles.toolButtonTextItalic}>I</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={handleUnderline}>
              <Text style={styles.toolButtonTextUnderline}>U</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolbarDivider} />

          {/* Alignment buttons */}
          <View style={styles.toolbarSection}>
            {TEXT_ALIGNMENTS.map((align) => (
              <TouchableOpacity
                key={align.value}
                style={[
                  styles.toolButton,
                  alignment === align.value && styles.toolButtonActive,
                ]}
                onPress={() => setAlignment(align.value as any)}
              >
                <Ionicons
                  name={
                    align.value === 'left'
                      ? 'reorder-three'
                      : align.value === 'center'
                      ? 'menu'
                      : 'reorder-three'
                  }
                  size={18}
                  color={alignment === align.value ? '#3b82f6' : '#6b7280'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toolbarDivider} />

          {/* Font settings button */}
          <TouchableOpacity
            style={styles.fontButton}
            onPress={() => setShowFontModal(true)}
          >
            <Text style={styles.fontButtonText}>Aa</Text>
            <Ionicons name="chevron-down" size={14} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Text Input */}
      <ScrollView
        style={[styles.inputContainer, { minHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              fontSize: getFontSize(),
              fontFamily: getFontFamily(),
              textAlign: alignment,
              minHeight: minHeight - 20,
            },
          ]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          autoFocus={autoFocus}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        />
      </ScrollView>

      {/* Font Settings Modal */}
      <Modal visible={showFontModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFontModal(false)}
        >
          <View style={styles.fontModalContent}>
            <Text style={styles.fontModalTitle}>Text Settings</Text>

            {/* Font Family */}
            <Text style={styles.fontModalLabel}>Font Family</Text>
            <View style={styles.fontOptions}>
              {FONT_FAMILIES.map((font) => (
                <TouchableOpacity
                  key={font.value}
                  style={[
                    styles.fontOption,
                    fontFamily === font.value && styles.fontOptionActive,
                  ]}
                  onPress={() => {
                    onFontFamilyChange?.(font.value);
                  }}
                >
                  <Text
                    style={[
                      styles.fontOptionText,
                      { fontFamily: font.value === 'System' ? undefined : font.value },
                      fontFamily === font.value && styles.fontOptionTextActive,
                    ]}
                  >
                    {font.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Font Size */}
            <Text style={styles.fontModalLabel}>Font Size</Text>
            <View style={styles.fontOptions}>
              {FONT_SIZES.map((size) => (
                <TouchableOpacity
                  key={size.value}
                  style={[
                    styles.fontOption,
                    fontSize === size.value && styles.fontOptionActive,
                  ]}
                  onPress={() => {
                    onFontSizeChange?.(size.value);
                  }}
                >
                  <Text
                    style={[
                      styles.fontOptionText,
                      { fontSize: size.size * 0.8 },
                      fontSize === size.value && styles.fontOptionTextActive,
                    ]}
                  >
                    {size.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.fontModalDone}
              onPress={() => setShowFontModal(false)}
            >
              <Text style={styles.fontModalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  toolbarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#d1d5db',
    marginHorizontal: 8,
  },
  toolButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  toolButtonActive: {
    backgroundColor: '#dbeafe',
  },
  toolButtonTextBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  toolButtonTextItalic: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#374151',
  },
  toolButtonTextUnderline: {
    fontSize: 16,
    textDecorationLine: 'underline',
    color: '#374151',
  },
  fontButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    gap: 4,
  },
  fontButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    padding: 12,
    color: '#1f2937',
    lineHeight: 24,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 320,
  },
  fontModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  fontModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    marginTop: 12,
  },
  fontOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  fontOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  fontOptionActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  fontOptionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  fontOptionTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  fontModalDone: {
    marginTop: 20,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fontModalDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

