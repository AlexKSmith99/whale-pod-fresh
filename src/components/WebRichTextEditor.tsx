import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

// Theme colors (matching team workspace dark theme)
const theme = {
  bg: '#0f0f0f',
  bgCard: '#1a1a1a',
  bgElevated: '#242424',
  accent: '#ff6b35',
  accentLight: 'rgba(255, 107, 53, 0.15)',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
  border: '#2a2a2a',
  divider: '#1f1f1f',
};

interface WebRichTextEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  editable?: boolean;
}

export default function WebRichTextEditor({
  initialContent = '',
  onChange,
  onSave,
  onCancel,
  placeholder = 'Start typing your notes...',
  editable = true,
}: WebRichTextEditorProps) {
  const richText = useRef<RichEditor>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Debounced change handler to avoid too frequent updates
  const handleContentChange = useCallback((html: string) => {
    onChange?.(html);
  }, [onChange]);

  const handleCursorPosition = useCallback((scrollY: number) => {
    // Scroll to keep cursor visible
    scrollRef.current?.scrollTo({ y: scrollY - 30, animated: true });
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header with Save/Cancel */}
      {editable && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editing</Text>
          <TouchableOpacity style={[styles.headerBtn, styles.saveBtn]} onPress={onSave}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rich Text Toolbar */}
      {editable && (
        <RichToolbar
          editor={richText}
          style={styles.toolbar}
          flatContainerStyle={styles.toolbarFlatContainer}
          iconTint={theme.text}
          selectedIconTint={theme.accent}
          selectedButtonStyle={styles.selectedButton}
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.setStrikethrough,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.heading1,
            actions.heading2,
            actions.alignLeft,
            actions.alignCenter,
            actions.alignRight,
            actions.undo,
            actions.redo,
          ]}
          iconMap={{
            [actions.heading1]: ({ tintColor }: { tintColor: string }) => (
              <Text style={[styles.toolbarIconText, { color: tintColor }]}>H1</Text>
            ),
            [actions.heading2]: ({ tintColor }: { tintColor: string }) => (
              <Text style={[styles.toolbarIconText, { color: tintColor }]}>H2</Text>
            ),
          }}
        />
      )}

      {/* Editor Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled={true}
        contentContainerStyle={styles.scrollContent}
      >
        <RichEditor
          ref={richText}
          style={styles.editor}
          containerStyle={styles.editorContainer}
          placeholder={placeholder}
          initialContentHTML={initialContent}
          onChange={handleContentChange}
          onCursorPosition={handleCursorPosition}
          editorStyle={{
            backgroundColor: theme.bg,
            color: theme.text,
            placeholderColor: theme.textMuted,
            caretColor: theme.accent,
            contentCSSText: `
              * {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              }
              body {
                font-size: 16px;
                line-height: 1.6;
                padding: 16px;
                margin: 0;
                min-height: 400px;
                color: ${theme.text};
                background-color: ${theme.bg};
              }
              h1 {
                font-size: 24px;
                font-weight: bold;
                margin: 16px 0 8px 0;
                color: ${theme.text};
              }
              h2 {
                font-size: 20px;
                font-weight: bold;
                margin: 14px 0 6px 0;
                color: ${theme.text};
              }
              p {
                margin: 8px 0;
              }
              ul, ol {
                margin: 8px 0;
                padding-left: 24px;
              }
              li {
                margin: 4px 0;
              }
            `,
          }}
          disabled={!editable}
          useContainer={true}
          initialFocus={false}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
    backgroundColor: theme.bgCard,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  cancelText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  toolbar: {
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    height: 44,
  },
  toolbarFlatContainer: {
    paddingHorizontal: 8,
  },
  selectedButton: {
    backgroundColor: theme.accentLight,
    borderRadius: 4,
  },
  toolbarIconText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  editor: {
    flex: 1,
    minHeight: 400,
    backgroundColor: theme.bg,
  },
  editorContainer: {
    flex: 1,
    backgroundColor: theme.bg,
  },
});
