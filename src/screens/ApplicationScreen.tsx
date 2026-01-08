import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { applicationService } from '../services/applicationService';

interface Props {
  pursuit: any;
  onBack: () => void;
  onSubmitted: () => void;
}

export default function ApplicationScreen({ pursuit, onBack, onSubmitted }: Props) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [resumeUrl, setResumeUrl] = useState('');

  // Use custom questions if provided, otherwise use default
  const questions = pursuit.application_questions && pursuit.application_questions.length > 0
    ? pursuit.application_questions
    : ['Why are you a good team fit?', 'Where do you hope to see this go?'];

  const isValidUrl = (url: string) => {
    if (!url.trim()) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    // Check all questions are answered
    const unanswered = questions.some((_: string, i: number) => !answers[i] || !answers[i].trim());
    if (unanswered) {
      Alert.alert('Incomplete', 'Please answer all questions');
      return;
    }

    // Check if resume is required but not provided
    if (pursuit.requires_resume && !resumeUrl.trim()) {
      Alert.alert('Resume Required', 'This pod requires a resume. Please provide a link to your resume.');
      return;
    }

    // Validate URL if provided
    if (resumeUrl.trim() && !isValidUrl(resumeUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    try {
      const formattedAnswers = questions.map((q: string, i: number) => ({
        question: q,
        answer: answers[i],
      }));

      await applicationService.createApplication({
        pursuit_id: pursuit.id,
        applicant_id: user?.id,
        answers: formattedAnswers,
        status: 'pending',
        resume_url: resumeUrl.trim() || null,
        resume_filename: resumeUrl.trim() ? 'Resume Link' : null,
      });

      Alert.alert(
        '🎉 Application Submitted!',
        'The pursuit creator will review your application and get back to you.',
        [{ text: 'OK', onPress: onSubmitted }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Apply to Pursuit</Text>
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
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
                />
              </View>
            ))}
          </View>

          {/* Resume URL Section */}
          {pursuit.requires_resume && (
            <View style={styles.resumeSection}>
              <View style={styles.resumeHeader}>
                <Ionicons name="document-attach" size={24} color="#8b5cf6" />
                <View style={styles.resumeHeaderText}>
                  <Text style={styles.resumeTitle}>Resume Required</Text>
                  <Text style={styles.resumeSubtitle}>This pod requires a resume</Text>
                </View>
              </View>

              <Text style={styles.resumeInstructions}>
                Paste a link to your resume hosted on Google Drive, Dropbox, OneDrive, or any file sharing service.
              </Text>

              <View style={styles.urlInputContainer}>
                <Ionicons name="link-outline" size={20} color="#9ca3af" style={styles.urlIcon} />
                <TextInput
                  style={styles.urlInput}
                  placeholder="https://drive.google.com/file/..."
                  placeholderTextColor="#9ca3af"
                  value={resumeUrl}
                  onChangeText={setResumeUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {resumeUrl.trim() !== '' && (
                  <TouchableOpacity onPress={() => setResumeUrl('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              {resumeUrl.trim() !== '' && isValidUrl(resumeUrl) && (
                <TouchableOpacity 
                  style={styles.previewLink}
                  onPress={() => Linking.openURL(resumeUrl)}
                >
                  <Ionicons name="open-outline" size={16} color="#8b5cf6" />
                  <Text style={styles.previewLinkText}>Preview link</Text>
                </TouchableOpacity>
              )}

              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={16} color="#f59e0b" />
                <Text style={styles.tipText}>
                  Tip: Make sure your file sharing link is set to "Anyone with the link can view"
                </Text>
              </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
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
  content: { padding: 20, paddingBottom: 100 },
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
    marginBottom: 12,
    lineHeight: 18,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  urlIcon: {
    marginRight: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 14,
  },
  clearButton: {
    padding: 4,
  },
  previewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  previewLinkText: {
    fontSize: 13,
    color: '#8b5cf6',
    fontWeight: '500',
    marginLeft: 4,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    marginLeft: 8,
    lineHeight: 16,
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
