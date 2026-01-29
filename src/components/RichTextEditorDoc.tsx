import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  Modal,
  Platform,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Theme colors (matching app theme)
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

// ============================================================================
// DOCUMENT MODEL
// Each character has its own formatting stored in a spans array.
// This allows Word-like behavior where formatting is per-character.
// ============================================================================

interface CharFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface TextSpan {
  text: string;
  format: CharFormat;
}

interface Paragraph {
  spans: TextSpan[];
  alignment: 'left' | 'center' | 'right';
}

interface DocumentContent {
  paragraphs: Paragraph[];
}

// Default formatting
const DEFAULT_FORMAT: CharFormat = {
  bold: false,
  italic: false,
  underline: false,
  color: '#ffffff',
  fontSize: 16,
  fontFamily: 'System',
};

// Font options
const FONT_FAMILIES = [
  { label: 'System', value: 'System' },
  { label: 'Serif', value: 'serif' },
  { label: 'Mono', value: 'monospace' },
];

const FONT_SIZES = [
  { label: '12', value: 12 },
  { label: '14', value: 14 },
  { label: '16', value: 16 },
  { label: '18', value: 18 },
  { label: '24', value: 24 },
];

const TEXT_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Gray', value: '#a0a0a0' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#ff6b35' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#10b981' },
];

interface RichTextEditorDocProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  editable?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Parse JSON content or create empty document
const parseContent = (content: string): DocumentContent => {
  if (!content) {
    return { paragraphs: [{ spans: [{ text: '', format: { ...DEFAULT_FORMAT } }], alignment: 'left' }] };
  }
  try {
    const parsed = JSON.parse(content);
    // Handle old format migration
    if (parsed.paragraphs) {
      return {
        paragraphs: parsed.paragraphs.map((p: any) => ({
          spans: p.spans?.map((s: any) => ({
            text: s.text || '',
            format: {
              bold: s.bold || s.format?.bold || false,
              italic: s.italic || s.format?.italic || false,
              underline: s.underline || s.format?.underline || false,
              color: s.color || s.format?.color || '#ffffff',
              fontSize: s.fontSize || s.format?.fontSize || 16,
              fontFamily: s.fontFamily || s.format?.fontFamily || 'System',
            }
          })) || [{ text: '', format: { ...DEFAULT_FORMAT } }],
          alignment: p.alignment || 'left',
        })),
      };
    }
    return { paragraphs: [{ spans: [{ text: '', format: { ...DEFAULT_FORMAT } }], alignment: 'left' }] };
  } catch {
    // Plain text - convert to document
    const lines = content.split('\n');
    return {
      paragraphs: lines.map(line => ({
        spans: [{ text: line, format: { ...DEFAULT_FORMAT } }],
        alignment: 'left' as const,
      })),
    };
  }
};

// Convert document to plain text (for TextInput value)
const documentToText = (doc: DocumentContent): string => {
  return doc.paragraphs
    .map(p => p.spans.map(s => s.text).join(''))
    .join('\n');
};

// Get the format at a specific character position
const getFormatAtPosition = (doc: DocumentContent, position: number): { format: CharFormat; paragraphIndex: number } => {
  let pos = 0;
  for (let pIdx = 0; pIdx < doc.paragraphs.length; pIdx++) {
    const para = doc.paragraphs[pIdx];
    for (const span of para.spans) {
      if (pos + span.text.length > position) {
        return { format: { ...span.format }, paragraphIndex: pIdx };
      }
      pos += span.text.length;
    }
    pos++; // newline
  }
  // Return last format or default
  const lastPara = doc.paragraphs[doc.paragraphs.length - 1];
  const lastSpan = lastPara?.spans[lastPara.spans.length - 1];
  return { 
    format: lastSpan?.format ? { ...lastSpan.format } : { ...DEFAULT_FORMAT },
    paragraphIndex: doc.paragraphs.length - 1
  };
};

// Check if two formats are equal
const formatsEqual = (a: CharFormat, b: CharFormat): boolean => {
  return a.bold === b.bold &&
         a.italic === b.italic &&
         a.underline === b.underline &&
         a.color === b.color &&
         a.fontSize === b.fontSize &&
         a.fontFamily === b.fontFamily;
};

// Merge adjacent spans with the same format
const mergeSpans = (spans: TextSpan[]): TextSpan[] => {
  if (spans.length === 0) return [{ text: '', format: { ...DEFAULT_FORMAT } }];
  
  const merged: TextSpan[] = [];
  for (const span of spans) {
    if (merged.length > 0 && formatsEqual(merged[merged.length - 1].format, span.format)) {
      merged[merged.length - 1].text += span.text;
    } else if (span.text.length > 0 || merged.length === 0) {
      merged.push({ text: span.text, format: { ...span.format } });
    }
  }
  return merged.length > 0 ? merged : [{ text: '', format: { ...DEFAULT_FORMAT } }];
};

// Apply formatting to a range in the document
// Returns a new document with the formatting applied ONLY to the specified range
const applyFormatToRange = (
  doc: DocumentContent,
  start: number,
  end: number,
  formatUpdate: Partial<CharFormat>
): DocumentContent => {
  if (start === end) return doc; // No selection, nothing to change
  
  const newParagraphs: Paragraph[] = [];
  let globalPos = 0;
  
  for (let pIdx = 0; pIdx < doc.paragraphs.length; pIdx++) {
    const para = doc.paragraphs[pIdx];
    const newSpans: TextSpan[] = [];
    let paraPos = globalPos;
    
    for (const span of para.spans) {
      const spanStart = paraPos;
      const spanEnd = paraPos + span.text.length;
      
      // Check overlap with selection
      const overlapStart = Math.max(spanStart, start);
      const overlapEnd = Math.min(spanEnd, end);
      
      if (overlapStart < overlapEnd) {
        // This span overlaps with selection - split it
        
        // Part before selection (unchanged)
        if (spanStart < overlapStart) {
          newSpans.push({
            text: span.text.substring(0, overlapStart - spanStart),
            format: { ...span.format },
          });
        }
        
        // Selected part (apply new format)
        newSpans.push({
          text: span.text.substring(overlapStart - spanStart, overlapEnd - spanStart),
          format: { ...span.format, ...formatUpdate },
        });
        
        // Part after selection (unchanged)
        if (spanEnd > overlapEnd) {
          newSpans.push({
            text: span.text.substring(overlapEnd - spanStart),
            format: { ...span.format },
          });
        }
      } else {
        // No overlap - keep span unchanged
        newSpans.push({ text: span.text, format: { ...span.format } });
      }
      
      paraPos += span.text.length;
    }
    
    newParagraphs.push({
      spans: mergeSpans(newSpans),
      alignment: para.alignment,
    });
    
    globalPos = paraPos + 1; // +1 for newline
  }
  
  return { paragraphs: newParagraphs };
};

// Apply alignment to paragraphs in range
const applyAlignmentToRange = (
  doc: DocumentContent,
  start: number,
  end: number,
  alignment: 'left' | 'center' | 'right'
): DocumentContent => {
  const newParagraphs: Paragraph[] = [];
  let globalPos = 0;
  
  for (const para of doc.paragraphs) {
    const paraLength = para.spans.reduce((sum, s) => sum + s.text.length, 0);
    const paraEnd = globalPos + paraLength;
    
    // Check if this paragraph intersects with selection
    const intersects = (globalPos <= end && paraEnd >= start) || (start === end && start >= globalPos && start <= paraEnd);
    
    newParagraphs.push({
      spans: para.spans.map(s => ({ ...s, format: { ...s.format } })),
      alignment: intersects ? alignment : para.alignment,
    });
    
    globalPos = paraEnd + 1; // +1 for newline
  }
  
  return { paragraphs: newParagraphs };
};

// Sync text changes back to document model
// This preserves existing formatting and only updates the text content
const syncTextToDocument = (
  oldDoc: DocumentContent,
  newText: string,
  selection: { start: number; end: number },
  typingFormat: CharFormat
): DocumentContent => {
  const oldText = documentToText(oldDoc);
  
  if (oldText === newText) return oldDoc;
  
  // Find what changed
  let changeStart = 0;
  while (changeStart < oldText.length && changeStart < newText.length && oldText[changeStart] === newText[changeStart]) {
    changeStart++;
  }
  
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > changeStart && newEnd > changeStart && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  
  const deletedLength = oldEnd - changeStart;
  const insertedText = newText.substring(changeStart, newEnd);
  
  // Build new document
  const newParagraphs: Paragraph[] = [];
  let globalPos = 0;
  
  for (let pIdx = 0; pIdx < oldDoc.paragraphs.length; pIdx++) {
    const para = oldDoc.paragraphs[pIdx];
    const paraText = para.spans.map(s => s.text).join('');
    const paraStart = globalPos;
    const paraEnd = globalPos + paraText.length;
    
    // Check if this paragraph is affected
    if (paraEnd < changeStart || paraStart > oldEnd) {
      // Paragraph is not affected
      newParagraphs.push({
        spans: para.spans.map(s => ({ text: s.text, format: { ...s.format } })),
        alignment: para.alignment,
      });
    } else {
      // Paragraph is affected - rebuild it
      const newSpans: TextSpan[] = [];
      let spanPos = paraStart;
      
      for (const span of para.spans) {
        const spanStart = spanPos;
        const spanEnd = spanPos + span.text.length;
        
        if (spanEnd <= changeStart) {
          // Span is before change
          newSpans.push({ text: span.text, format: { ...span.format } });
        } else if (spanStart >= oldEnd) {
          // Span is after change (adjust for length difference)
          newSpans.push({ text: span.text, format: { ...span.format } });
        } else {
          // Span overlaps with change
          
          // Part before change
          if (spanStart < changeStart) {
            newSpans.push({
              text: span.text.substring(0, changeStart - spanStart),
              format: { ...span.format },
            });
          }
          
          // Inserted text (with typing format)
          if (insertedText && spanStart <= changeStart && spanEnd >= changeStart) {
            // Handle newlines in inserted text
            const insertedLines = insertedText.split('\n');
            for (let i = 0; i < insertedLines.length; i++) {
              if (insertedLines[i]) {
                newSpans.push({
                  text: insertedLines[i],
                  format: { ...typingFormat },
                });
              }
              if (i < insertedLines.length - 1) {
                // Need to split paragraph here
                newParagraphs.push({
                  spans: mergeSpans(newSpans),
                  alignment: para.alignment,
                });
                newSpans.length = 0;
              }
            }
          }
          
          // Part after change
          if (spanEnd > oldEnd) {
            newSpans.push({
              text: span.text.substring(oldEnd - spanStart),
              format: { ...span.format },
            });
          }
        }
        
        spanPos += span.text.length;
      }
      
      if (newSpans.length > 0 || newParagraphs.length === 0) {
        newParagraphs.push({
          spans: mergeSpans(newSpans),
          alignment: para.alignment,
        });
      }
    }
    
    globalPos = paraEnd + 1; // +1 for newline
  }
  
  // Handle case where newlines were added at the end
  const newLines = newText.split('\n');
  const oldLines = oldText.split('\n');
  while (newParagraphs.length < newLines.length) {
    newParagraphs.push({
      spans: [{ text: newLines[newParagraphs.length] || '', format: { ...typingFormat } }],
      alignment: 'left',
    });
  }
  
  // Handle case where paragraphs were removed
  while (newParagraphs.length > newLines.length) {
    newParagraphs.pop();
  }
  
  // Sync text content to ensure it matches
  for (let i = 0; i < newParagraphs.length; i++) {
    const expectedText = newLines[i];
    const actualText = newParagraphs[i].spans.map(s => s.text).join('');
    if (actualText !== expectedText) {
      // Text doesn't match - rebuild this paragraph preserving as much formatting as possible
      if (expectedText === '') {
        newParagraphs[i].spans = [{ text: '', format: { ...typingFormat } }];
      } else {
        // Keep the format from the first span or use typing format
        const format = newParagraphs[i].spans[0]?.format || typingFormat;
        newParagraphs[i].spans = [{ text: expectedText, format: { ...format } }];
      }
    }
  }
  
  return { paragraphs: newParagraphs };
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function RichTextEditorDoc({
  initialContent = '',
  onChange,
  onSave,
  onCancel,
  placeholder = 'Start typing...',
  editable = true,
}: RichTextEditorDocProps) {
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  
  // Document state - this is the source of truth for formatting
  const [document, setDocument] = useState<DocumentContent>(() => parseContent(initialContent));
  
  // Text state for TextInput (derived from document)
  const text = useMemo(() => documentToText(document), [document]);
  
  // Selection state
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  
  // "Typing format" - the format that will be applied to newly typed text
  // This is set when the user clicks a format button with no selection
  const [typingFormat, setTypingFormat] = useState<CharFormat>({ ...DEFAULT_FORMAT });
  
  // Modal states
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Initialize from content
  useEffect(() => {
    const doc = parseContent(initialContent);
    setDocument(doc);
    // Initialize typing format from first character
    if (doc.paragraphs[0]?.spans[0]?.format) {
      setTypingFormat({ ...doc.paragraphs[0].spans[0].format });
    }
  }, [initialContent]);

  // Get the current format at selection (for toolbar display)
  const currentFormat = useMemo(() => {
    if (selection.start === selection.end) {
      // Caret position - return typing format
      return typingFormat;
    }
    // Selection - return format at start of selection
    return getFormatAtPosition(document, selection.start).format;
  }, [document, selection, typingFormat]);

  // Get current alignment (paragraph-level)
  const currentAlignment = useMemo(() => {
    const { paragraphIndex } = getFormatAtPosition(document, selection.start);
    return document.paragraphs[paragraphIndex]?.alignment || 'left';
  }, [document, selection]);

  // ============================================================================
  // FORMAT HANDLERS
  // These handle the Word-like behavior:
  // - If selection exists: apply to selection only
  // - If no selection (caret): set typing format for future input
  // ============================================================================

  const handleFormatChange = useCallback((formatUpdate: Partial<CharFormat>) => {
    if (selection.start === selection.end) {
      // NO SELECTION (caret only) - set typing format for future input
      setTypingFormat(prev => ({ ...prev, ...formatUpdate }));
    } else {
      // SELECTION EXISTS - apply format to selected text only
      setDocument(prev => applyFormatToRange(prev, selection.start, selection.end, formatUpdate));
    }
  }, [selection]);

  const handleAlignmentChange = useCallback((alignment: 'left' | 'center' | 'right') => {
    // Alignment is paragraph-level - apply to paragraph(s) at selection
    setDocument(prev => applyAlignmentToRange(prev, selection.start, selection.end, alignment));
  }, [selection]);

  const toggleBold = useCallback(() => {
    handleFormatChange({ bold: !currentFormat.bold });
  }, [currentFormat.bold, handleFormatChange]);

  const toggleItalic = useCallback(() => {
    handleFormatChange({ italic: !currentFormat.italic });
  }, [currentFormat.italic, handleFormatChange]);

  const toggleUnderline = useCallback(() => {
    handleFormatChange({ underline: !currentFormat.underline });
  }, [currentFormat.underline, handleFormatChange]);

  const setFontSize = useCallback((size: number) => {
    handleFormatChange({ fontSize: size });
    setShowSizePicker(false);
  }, [handleFormatChange]);

  const setFontFamily = useCallback((family: string) => {
    handleFormatChange({ fontFamily: family });
    setShowFontPicker(false);
  }, [handleFormatChange]);

  const setTextColor = useCallback((color: string) => {
    handleFormatChange({ color });
    setShowColorPicker(false);
  }, [handleFormatChange]);

  // Track if we need to notify parent of changes
  const [pendingChange, setPendingChange] = useState<string | null>(null);

  // Handle text changes from TextInput
  const handleTextChange = useCallback((newText: string) => {
    setDocument(prev => {
      const newDoc = syncTextToDocument(prev, newText, selection, typingFormat);
      // Schedule notification to parent (will happen in useEffect)
      setPendingChange(JSON.stringify(newDoc));
      return newDoc;
    });
  }, [selection, typingFormat]);

  // Notify parent of changes outside of render cycle
  useEffect(() => {
    if (pendingChange !== null) {
      onChange?.(pendingChange);
      setPendingChange(null);
    }
  }, [pendingChange, onChange]);

  // Handle selection change
  const handleSelectionChange = useCallback((e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const newSelection = e.nativeEvent.selection;
    setSelection(newSelection);
  }, []);

  // Update typing format when caret moves (no selection)
  // Using useEffect to avoid setState during render
  useEffect(() => {
    if (selection.start === selection.end) {
      const { format } = getFormatAtPosition(document, selection.start);
      // Only update if format actually changed to avoid infinite loops
      setTypingFormat(prev => {
        if (formatsEqual(prev, format)) return prev;
        return format;
      });
    }
  }, [selection.start, selection.end, document]);

  // ============================================================================
  // RENDER STYLED TEXT
  // Uses nested Text components to render each span with its own style
  // ============================================================================

  const renderStyledText = useCallback(() => {
    return document.paragraphs.map((para, pIdx) => (
      <Text
        key={pIdx}
        style={[
          styles.paragraph,
          { textAlign: para.alignment },
        ]}
      >
        {para.spans.map((span, sIdx) => {
          const style: TextStyle = {
            color: span.format.color || '#ffffff',
            fontSize: span.format.fontSize || 16,
          };
          if (span.format.fontFamily && span.format.fontFamily !== 'System') {
            style.fontFamily = span.format.fontFamily;
          }
          if (span.format.bold) style.fontWeight = 'bold';
          if (span.format.italic) style.fontStyle = 'italic';
          if (span.format.underline) style.textDecorationLine = 'underline';
          
          return (
            <Text key={sIdx} style={style}>
              {span.text || (sIdx === 0 && para.spans.length === 1 ? ' ' : '')}
            </Text>
          );
        })}
        {pIdx < document.paragraphs.length - 1 ? '\n' : ''}
      </Text>
    ));
  }, [document]);

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

      {/* Toolbar - shows current format state from selection/typing */}
      {editable && (
        <View style={styles.toolbar}>
          <View style={styles.toolbarRow}>
            {/* Font Family */}
            <TouchableOpacity 
              style={styles.pickerBtn} 
              onPress={() => setShowFontPicker(true)}
            >
              <Text style={styles.pickerBtnText}>
                {FONT_FAMILIES.find(f => f.value === currentFormat.fontFamily)?.label || 'Font'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Font Size */}
            <TouchableOpacity 
              style={styles.pickerBtn} 
              onPress={() => setShowSizePicker(true)}
            >
              <Text style={styles.pickerBtnText}>{currentFormat.fontSize || 16}</Text>
              <Ionicons name="chevron-down" size={12} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Bold - shows active state from current format */}
            <TouchableOpacity 
              style={[styles.formatBtn, currentFormat.bold && styles.formatBtnActive]} 
              onPress={toggleBold}
            >
              <Text style={[styles.formatBtnTextBold, currentFormat.bold && styles.formatBtnTextActive]}>B</Text>
            </TouchableOpacity>

            {/* Italic */}
            <TouchableOpacity 
              style={[styles.formatBtn, currentFormat.italic && styles.formatBtnActive]} 
              onPress={toggleItalic}
            >
              <Text style={[styles.formatBtnTextItalic, currentFormat.italic && styles.formatBtnTextActive]}>I</Text>
            </TouchableOpacity>

            {/* Underline */}
            <TouchableOpacity 
              style={[styles.formatBtn, currentFormat.underline && styles.formatBtnActive]} 
              onPress={toggleUnderline}
            >
              <Text style={[styles.formatBtnTextUnderline, currentFormat.underline && styles.formatBtnTextActive]}>U</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Text Color */}
            <TouchableOpacity 
              style={styles.colorBtn} 
              onPress={() => setShowColorPicker(true)}
            >
              <View style={[styles.colorIndicator, { backgroundColor: currentFormat.color || '#ffffff' }]} />
              <Ionicons name="chevron-down" size={10} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Toolbar Row 2: Alignment */}
          <View style={styles.toolbarRow}>
            <TouchableOpacity 
              style={[styles.alignBtn, currentAlignment === 'left' && styles.alignBtnActive]} 
              onPress={() => handleAlignmentChange('left')}
            >
              <Ionicons 
                name="reorder-three-outline" 
                size={18} 
                color={currentAlignment === 'left' ? theme.accent : theme.text} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.alignBtn, currentAlignment === 'center' && styles.alignBtnActive]} 
              onPress={() => handleAlignmentChange('center')}
            >
              <Ionicons 
                name="menu-outline" 
                size={18} 
                color={currentAlignment === 'center' ? theme.accent : theme.text} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.alignBtn, currentAlignment === 'right' && styles.alignBtnActive]} 
              onPress={() => handleAlignmentChange('right')}
            >
              <Ionicons 
                name="reorder-three-outline" 
                size={18} 
                color={currentAlignment === 'right' ? theme.accent : theme.text} 
                style={{ transform: [{ scaleX: -1 }] }}
              />
            </TouchableOpacity>
            
            {/* Selection indicator */}
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionInfoText}>
                {selection.start === selection.end 
                  ? 'Caret' 
                  : `Selected: ${selection.end - selection.start} chars`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Editor Area */}
      <ScrollView 
        ref={scrollRef}
        style={styles.editorScroll}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.editorContainer}>
          {/* Styled text display (shows formatting) */}
          <View style={styles.styledTextContainer} pointerEvents="none">
            {renderStyledText()}
          </View>
          
          {/* Invisible TextInput for capturing input */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={text}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            selection={selection}
            multiline
            autoFocus={editable}
            editable={editable}
            placeholder={placeholder}
            placeholderTextColor="transparent"
            selectionColor={theme.accent}
            textAlignVertical="top"
            caretHidden={false}
          />
          
          {/* Placeholder */}
          {text.length === 0 && (
            <Text style={styles.placeholder}>{placeholder}</Text>
          )}
        </View>
      </ScrollView>

      {/* Font Family Picker Modal */}
      <Modal visible={showFontPicker} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowFontPicker(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Font Family</Text>
            {FONT_FAMILIES.map((font) => (
              <TouchableOpacity
                key={font.value}
                style={[
                  styles.pickerOption,
                  currentFormat.fontFamily === font.value && styles.pickerOptionActive
                ]}
                onPress={() => setFontFamily(font.value)}
              >
                <Text style={[
                  styles.pickerOptionText,
                  font.value !== 'System' && { fontFamily: font.value },
                  currentFormat.fontFamily === font.value && styles.pickerOptionTextActive
                ]}>
                  {font.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Font Size Picker Modal */}
      <Modal visible={showSizePicker} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowSizePicker(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Font Size</Text>
            <View style={styles.sizeGrid}>
              {FONT_SIZES.map((size) => (
                <TouchableOpacity
                  key={size.value}
                  style={[
                    styles.sizeOption,
                    currentFormat.fontSize === size.value && styles.pickerOptionActive
                  ]}
                  onPress={() => setFontSize(size.value)}
                >
                  <Text style={[
                    styles.sizeOptionText,
                    currentFormat.fontSize === size.value && styles.pickerOptionTextActive
                  ]}>
                    {size.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowColorPicker(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Text Color</Text>
            <View style={styles.colorGrid}>
              {TEXT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  style={[
                    styles.colorOption,
                    currentFormat.color === color.value && styles.colorOptionActive
                  ]}
                  onPress={() => setTextColor(color.value)}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: color.value }]} />
                  <Text style={styles.colorLabel}>{color.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingVertical: 6,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 6,
    gap: 4,
  },
  pickerBtnText: {
    fontSize: 13,
    color: theme.text,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: theme.border,
    marginHorizontal: 8,
  },
  formatBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 2,
  },
  formatBtnActive: {
    backgroundColor: theme.accentLight,
  },
  formatBtnTextBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  formatBtnTextItalic: {
    fontSize: 16,
    fontStyle: 'italic',
    color: theme.text,
  },
  formatBtnTextUnderline: {
    fontSize: 16,
    textDecorationLine: 'underline',
    color: theme.text,
  },
  formatBtnTextActive: {
    color: theme.accent,
  },
  colorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 4,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.border,
  },
  alignBtn: {
    width: 36,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 2,
  },
  alignBtnActive: {
    backgroundColor: theme.accentLight,
  },
  selectionInfo: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
  },
  selectionInfoText: {
    fontSize: 11,
    color: theme.textMuted,
  },
  editorScroll: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
    minHeight: 400,
    position: 'relative',
  },
  styledTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 1,
  },
  hiddenInput: {
    flex: 1,
    minHeight: 400,
    padding: 16,
    color: 'transparent',
    fontSize: 16,
    lineHeight: 24,
    zIndex: 2,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.text,
  },
  placeholder: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontSize: 16,
    color: theme.textMuted,
    zIndex: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxWidth: 300,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionActive: {
    backgroundColor: theme.accentLight,
  },
  pickerOptionText: {
    fontSize: 15,
    color: theme.text,
  },
  pickerOptionTextActive: {
    color: theme.accent,
    fontWeight: '600',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeOption: {
    width: 50,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bgElevated,
    borderRadius: 6,
  },
  sizeOptionText: {
    fontSize: 14,
    color: theme.text,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  colorOptionActive: {
    backgroundColor: theme.accentLight,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: theme.border,
  },
  colorLabel: {
    fontSize: 11,
    color: theme.textSecondary,
  },
});

