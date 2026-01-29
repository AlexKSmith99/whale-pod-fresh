import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../contexts/AuthContext';
import { applicationService } from '../services/applicationService';
import { supabase } from '../config/supabase';
import { colors } from '../theme/designSystem';

interface Props {
  pursuit: any;
  onBack: () => void;
  onSubmitted: () => void;
}

export default function ApplicationScreen({ pursuit, onBack, onSubmitted }: Props) {
  const { user } = useAuth();
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Apply to Pursuit</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.pursuitCard}>
            <Text style={styles.pursuitTitle}>{pursuit.title}</Text>
            <Text style={styles.pursuitDescription} numberOfLines={2}>
              {pursuit.description}
            </Text>
          </View>

          <View style={styles.questionsSection}>
            <Text style={styles.sectionTitle}>Application Questions</Text>
            
            {questions.map((question: string, index: number) => (
              <View key={index} style={styles.questionBlock}>
                <Text style={styles.questionNumber}>Question {index + 1}</Text>
                <Text style={styles.questionText}>{question}</Text>
                <TextInput
                  style={styles.answerInput}
                  placeholder="Your answer..."
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
            <View style={styles.resumeSection}>
              <View style={styles.resumeHeader}>
                <Ionicons name="document-attach" size={24} color="#8b5cf6" />
                <View style={styles.resumeHeaderText}>
                  <Text style={styles.resumeTitle}>Resume Required</Text>
                  <Text style={styles.resumeSubtitle}>This pod requires a resume</Text>
                </View>
              </View>

              {!resumeFile ? (
                <>
                  <Text style={styles.resumeInstructions}>
                    Upload your resume in PDF or Word format (max 10MB)
                  </Text>

                  <TouchableOpacity 
                    style={styles.uploadButton}
                    onPress={pickDocument}
                    disabled={uploadingResume}
                  >
                    <Ionicons name="cloud-upload-outline" size={24} color="#8b5cf6" />
                    <Text style={styles.uploadButtonText}>Choose File</Text>
                  </TouchableOpacity>

                  <View style={styles.supportedFormats}>
                    <Text style={styles.supportedFormatsText}>
                      Supported: PDF, DOC, DOCX
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.selectedFileContainer}>
                  <View style={styles.selectedFile}>
                    <View style={styles.fileIconContainer}>
                      <Ionicons 
                        name={resumeFile.name.endsWith('.pdf') ? 'document' : 'document-text'} 
                        size={28} 
                        color="#8b5cf6" 
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{resumeFile.name}</Text>
                      {resumeFile.size && (
                        <Text style={styles.fileSize}>{formatFileSize(resumeFile.size)}</Text>
                      )}
                    </View>
                    <TouchableOpacity 
                      style={styles.removeFileButton}
                      onPress={() => setResumeFile(null)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={styles.changeFileButton}
                    onPress={pickDocument}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#8b5cf6" />
                    <Text style={styles.changeFileText}>Change file</Text>
                  </TouchableOpacity>
                </View>
              )}

              {uploadingResume && (
                <View style={styles.uploadingIndicator}>
                  <ActivityIndicator size="small" color="#8b5cf6" />
                  <Text style={styles.uploadingText}>Uploading resume...</Text>
                </View>
              )}
            </View>
          )}

          {pursuit.requires_interview && (
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🎤</Text>
              <Text style={styles.infoText}>
                This pursuit requires an interview. You may be contacted for one.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Submitting...' : '🚀 Submit Application'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    backgroundColor: '#fff', 
    padding: 20, 
    paddingTop: 60, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, color: '#0ea5e9', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { padding: 20, paddingBottom: 120 },
  pursuitCard: { 
    backgroundColor: '#e0f2fe', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  pursuitTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  pursuitDescription: { fontSize: 14, color: '#666' },
  questionsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  questionBlock: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  questionNumber: { fontSize: 12, fontWeight: 'bold', color: '#0ea5e9', marginBottom: 4 },
  questionText: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 12 },
  answerInput: { 
    backgroundColor: '#fafafa', 
    borderWidth: 1, 
    borderColor: '#e5e5e5', 
    borderRadius: 8, 
    padding: 12, 
    fontSize: 14,
    height: 100,
    textAlignVertical: 'top',
  },
  // Resume Section Styles
  resumeSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#8b5cf6',
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
    color: '#333',
  },
  resumeSubtitle: {
    fontSize: 13,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  resumeInstructions: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    borderStyle: 'dashed',
    gap: 10,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  supportedFormats: {
    alignItems: 'center',
    marginTop: 12,
  },
  supportedFormatsText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  selectedFileContainer: {
    marginTop: 4,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#fff',
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
    color: '#1f2937',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6b7280',
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
    color: '#8b5cf6',
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
    color: '#8b5cf6',
  },
  infoBox: { 
    flexDirection: 'row',
    backgroundColor: '#eff6ff', 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  infoIcon: { fontSize: 20, marginRight: 12 },
  infoText: { flex: 1, fontSize: 13, color: '#0369a1' },
  submitButton: { 
    backgroundColor: '#0ea5e9', 
    borderRadius: 12, 
    padding: 18, 
    alignItems: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
