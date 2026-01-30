import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../contexts/AuthContext';
import { applicationService } from '../services/applicationService';
import { supabase } from '../config/supabase';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  pursuit: any;
  onBack: () => void;
  onSubmitted: () => void;
}

export default function ApplicationScreen({ pursuit, onBack, onSubmitted }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const scrollViewRef = useRef<ScrollView>(null);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  // Use custom questions if provided, otherwise use default
  const questions = pursuit.application_questions && pursuit.application_questions.length > 0
    ? pursuit.application_questions
    : ['Why are you a good team fit?', 'Where do you hope to see this go?'];

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Check file size (max 10MB)
        if (file.size && file.size > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
          return;
        }

        setResumeFile({
          uri: file.uri,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const uploadResume = async (): Promise<string | null> => {
    if (!resumeFile || !user) return null;

    setUploadingResume(true);
    try {
      // Create a unique filename
      const fileName = `${user.id}/${Date.now()}_${resumeFile.name}`;

      // Read file as base64
      const response = await fetch(resumeFile.uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(fileName, uint8Array, {
          contentType: resumeFile.mimeType || 'application/pdf',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error('Failed to upload resume');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading resume:', error);
      throw error;
    } finally {
      setUploadingResume(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    // Check all questions are answered
    const unanswered = questions.some((_: string, i: number) => !answers[i] || !answers[i].trim());
    if (unanswered) {
      Alert.alert('Incomplete', 'Please answer all questions');
      return;
    }

    // Check if resume is required but not provided
    if (pursuit.requires_resume && !resumeFile) {
      Alert.alert('Resume Required', 'This pod requires a resume. Please upload your resume.');
      return;
    }

    setLoading(true);
    console.log('🚀 Starting application submission...');
    try {
      // Upload resume if provided
      let resumeUrl = null;
      if (resumeFile) {
        console.log('📎 Uploading resume...');
        resumeUrl = await uploadResume();
        console.log('📎 Resume uploaded:', resumeUrl);
      }

      const formattedAnswers = questions.map((q: string, i: number) => ({
        question: q,
        answer: answers[i],
      }));

      console.log('📝 Calling applicationService.createApplication...');
      console.log('📝 Pursuit ID:', pursuit.id);
      console.log('📝 Applicant ID:', user?.id);

      await applicationService.createApplication({
        pursuit_id: pursuit.id,
        applicant_id: user?.id,
        answers: formattedAnswers,
        status: 'pending',
        resume_url: resumeUrl,
        resume_filename: resumeFile?.name || null,
      });

      console.log('✅ Application created successfully!');

      Alert.alert(
        '🎉 Application Submitted!',
        'The pursuit creator will review your application and get back to you.',
        [{ text: 'OK', onPress: onSubmitted }]
      );
    } catch (error: any) {
      console.error('❌ Application submission error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic accent color for purple elements
  const accentPurple = isNewTheme ? colors.primary : '#8b5cf6';
  const accentPurpleLight = isNewTheme ? colors.primaryLight : '#f3e8ff';
  const accentPurpleBorder = isNewTheme ? colors.primary : '#ddd6fe';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: isNewTheme ? colors.accentGreen : '#0ea5e9' }]}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isNewTheme ? colors.accentGreen : colors.textPrimary, fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : undefined }]}>Apply to Pursuit</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={[styles.pursuitCard, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#e0f2fe', borderLeftColor: isNewTheme ? colors.accentGreen : '#0ea5e9' }]}>
            <Text style={[styles.pursuitTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{pursuit.title}</Text>
            <Text style={[styles.pursuitDescription, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]} numberOfLines={2}>
              {pursuit.description}
            </Text>
          </View>

          <View style={styles.questionsSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>Application Questions</Text>

            {questions.map((question: string, index: number) => (
              <View key={index} style={[styles.questionBlock, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
                <Text style={[styles.questionNumber, { color: isNewTheme ? colors.accentGreen : '#0ea5e9', fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>Question {index + 1}</Text>
                <Text style={[styles.questionText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{question}</Text>
                <TextInput
                  style={[styles.answerInput, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#fafafa', borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}
                  placeholder="Your answer..."
                  placeholderTextColor={colors.textTertiary}
                  value={answers[index] || ''}
                  onChangeText={(text) => setAnswers({ ...answers, [index]: text })}
                  multiline
                  numberOfLines={4}
                  spellCheck={true}
                  autoCorrect={true}
                  onFocus={() => {
                    // Scroll to make the input visible when focused
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                />
              </View>
            ))}
          </View>

          {/* Resume Upload Section */}
          {pursuit.requires_resume && (
            <View style={[styles.resumeSection, { backgroundColor: colors.surface, borderColor: accentPurple, borderWidth: isNewTheme ? 1 : 2 }]}>
              <View style={styles.resumeHeader}>
                <Ionicons name="document-attach" size={24} color={accentPurple} />
                <View style={styles.resumeHeaderText}>
                  <Text style={[styles.resumeTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Resume Required</Text>
                  <Text style={[styles.resumeSubtitle, { color: accentPurple, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>This pod requires a resume</Text>
                </View>
              </View>

              {!resumeFile ? (
                <>
                  <Text style={[styles.resumeInstructions, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                    Upload your resume in PDF or Word format (max 10MB)
                  </Text>

                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: accentPurpleLight, borderColor: accentPurple }]}
                    onPress={pickDocument}
                    disabled={uploadingResume}
                  >
                    <Ionicons name="cloud-upload-outline" size={24} color={accentPurple} />
                    <Text style={[styles.uploadButtonText, { color: accentPurple, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Choose File</Text>
                  </TouchableOpacity>

                  <View style={styles.supportedFormats}>
                    <Text style={[styles.supportedFormatsText, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                      Supported: PDF, DOC, DOCX
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.selectedFileContainer}>
                  <View style={[styles.selectedFile, { backgroundColor: accentPurpleLight, borderColor: accentPurpleBorder }]}>
                    <View style={[styles.fileIconContainer, { backgroundColor: colors.surface }]}>
                      <Ionicons
                        name={resumeFile.name.endsWith('.pdf') ? 'document' : 'document-text'}
                        size={28}
                        color={accentPurple}
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={[styles.fileName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1}>{resumeFile.name}</Text>
                      {resumeFile.size && (
                        <Text style={[styles.fileSize, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{formatFileSize(resumeFile.size)}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.removeFileButton}
                      onPress={() => setResumeFile(null)}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.changeFileButton}
                    onPress={pickDocument}
                  >
                    <Ionicons name="swap-horizontal" size={16} color={accentPurple} />
                    <Text style={[styles.changeFileText, { color: accentPurple, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Change file</Text>
                  </TouchableOpacity>
                </View>
              )}

              {uploadingResume && (
                <View style={styles.uploadingIndicator}>
                  <ActivityIndicator size="small" color={accentPurple} />
                  <Text style={[styles.uploadingText, { color: accentPurple, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>Uploading resume...</Text>
                </View>
              )}
            </View>
          )}

          {pursuit.requires_interview && (
            <View style={[styles.infoBox, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#eff6ff', borderLeftColor: isNewTheme ? colors.accentGreen : '#0ea5e9' }]}>
              <Text style={styles.infoIcon}>🎤</Text>
              <Text style={[styles.infoText, { color: isNewTheme ? colors.textSecondary : '#0369a1', fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                This pursuit requires an interview. You may be contacted for one.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: isNewTheme ? colors.accentGreen : '#0ea5e9', shadowColor: isNewTheme ? colors.accentGreen : '#0ea5e9' }, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={[styles.submitButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              {loading ? 'Submitting...' : '🚀 Submit Application'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { padding: 20, paddingBottom: 120 },
  pursuitCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
  },
  pursuitTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  pursuitDescription: { fontSize: 14 },
  questionsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  questionBlock: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  questionNumber: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  questionText: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  answerInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    height: 100,
    textAlignVertical: 'top',
  },
  // Resume Section Styles
  resumeSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resumeHeaderText: {
    marginLeft: 12,
  },
  resumeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resumeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  resumeInstructions: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 10,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  supportedFormats: {
    alignItems: 'center',
    marginTop: 12,
  },
  supportedFormatsText: {
    fontSize: 12,
  },
  selectedFileContainer: {
    marginTop: 4,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
  },
  removeFileButton: {
    padding: 4,
  },
  changeFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  changeFileText: {
    fontSize: 14,
    fontWeight: '500',
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  uploadingText: {
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
  },
  infoIcon: { fontSize: 20, marginRight: 12 },
  infoText: { flex: 1, fontSize: 13 },
  submitButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 17, fontWeight: 'bold' },
});
