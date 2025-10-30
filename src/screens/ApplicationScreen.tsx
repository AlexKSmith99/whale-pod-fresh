import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
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

  // Use custom questions if provided, otherwise use default
  const questions = pursuit.application_questions && pursuit.application_questions.length > 0
    ? pursuit.application_questions
    : ['Why are you a good team fit?', 'Where do you hope to see this go?'];

  const handleSubmit = async () => {
    // Check all questions are answered
    const unanswered = questions.some((_, i) => !answers[i] || !answers[i].trim());
    if (unanswered) {
      Alert.alert('Incomplete', 'Please answer all questions');
      return;
    }

    setLoading(true);
    try {
      const formattedAnswers = questions.map((q, i) => ({
        question: q,
        answer: answers[i],
      }));

      await applicationService.createApplication({
        pursuit_id: pursuit.id,
        applicant_id: user?.id,
        answers: formattedAnswers,
        status: 'pending',
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

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.pursuitCard}>
            <Text style={styles.pursuitTitle}>{pursuit.title}</Text>
            <Text style={styles.pursuitDescription} numberOfLines={2}>
              {pursuit.description}
            </Text>
          </View>

          <View style={styles.questionsSection}>
            <Text style={styles.sectionTitle}>Application Questions</Text>
            
            {questions.map((question, index) => (
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
                />
              </View>
            ))}
          </View>

          {pursuit.requires_resume && (
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>📄</Text>
              <Text style={styles.infoText}>
                This pursuit requires a resume. Make sure your profile has one attached.
              </Text>
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
