import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, StatusBar } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { pursuitService } from '../services/pursuitService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

const PURSUIT_TYPES = ['Education', 'Friends', 'Problem', 'Business', 'Lifestyle', 'Hobby', 'Side Hustle', 'Travel', 'Discussion', 'New Endeavor', 'Accountability'];
const DECISION_SYSTEMS = ['Standard Vote', 'Admin Has Ultimate Say', 'Delegated', 'Weighted Voting'];
const ATTENDANCE_STYLES = ['Mandatory', 'Optional', 'Frequent'];

export default function CreateScreen() {
  const { user } = useAuth();
  
  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamSizeMin, setTeamSizeMin] = useState('2');
  const [teamSizeMax, setTeamSizeMax] = useState('8');
  const [teamSizeFlexible, setTeamSizeFlexible] = useState(false);
  const [location, setLocation] = useState('');
  const [projectedDuration, setProjectedDuration] = useState('');
  
  // Types & Categories
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState('');
  
  // Business
  const [ownershipStructure, setOwnershipStructure] = useState('');
  
  // Decision & Meeting
  const [decisionSystem, setDecisionSystem] = useState('Standard Vote');
  const [decisionNote, setDecisionNote] = useState('');
  const [meetingCadence, setMeetingCadence] = useState('');
  const [meetingNote, setMeetingNote] = useState('');
  const [attendanceStyle, setAttendanceStyle] = useState('Mandatory');
  const [attendanceNote, setAttendanceNote] = useState('');
  
  // Optional Fields
  const [accountabilityMechanics, setAccountabilityMechanics] = useState('');
  const [roles, setRoles] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const [ageRestriction, setAgeRestriction] = useState('');
  
  // Application Settings
  const [continueAccepting, setContinueAccepting] = useState(false);
  const [requiresInterview, setRequiresInterview] = useState(false);
  const [requiresResume, setRequiresResume] = useState(false);
  const [applicationQuestions, setApplicationQuestions] = useState('');
  
  const [loading, setLoading] = useState(false);

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else if (selectedTypes.length < 3) {
      setSelectedTypes([...selectedTypes, type]);
    } else {
      Alert.alert('Limit Reached', 'You can select up to 3 pursuit types');
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!title || !description || !location || !meetingCadence) {
      Alert.alert('Missing Fields', 'Please fill in all required fields (marked with *)');
      return;
    }

    if (description.length < 50) {
      Alert.alert('Description Too Short', 'Description must be at least 50 characters');
      return;
    }

    if (selectedTypes.length === 0) {
      Alert.alert('Missing Type', 'Please select at least one pursuit type');
      return;
    }

    setLoading(true);
    try {
      await pursuitService.createPursuit({
        creator_id: user?.id,
        title,
        description,
        team_size_min: parseInt(teamSizeMin) || 2,
        team_size_max: parseInt(teamSizeMax) || 8,
        team_size_flexible: teamSizeFlexible,
        location,
        projected_duration: projectedDuration || null,
        pursuit_types: selectedTypes,
        pursuit_categories: categories ? categories.split(',').map(c => c.trim()) : [],
        ownership_structure: ownershipStructure || null,
        decision_system: decisionSystem.toLowerCase().replace(/ /g, '_'),
        decision_system_note: decisionNote || null,
        meeting_cadence: meetingCadence,
        meeting_cadence_note: meetingNote || null,
        attendance_style: attendanceStyle,
        attendance_note: attendanceNote || null,
        accountability_mechanics: accountabilityMechanics ? accountabilityMechanics.split(',').map(m => m.trim()) : null,
        roles: roles ? roles.split(',').map(r => r.trim()) : null,
        experience_level: experienceLevel || null,
        current_stage: currentStage || null,
        age_restriction: ageRestriction || null,
        continue_accepting_after_kickoff: continueAccepting,
        requires_interview: requiresInterview,
        requires_resume: requiresResume,
        application_questions: applicationQuestions ? applicationQuestions.split('\n').filter(q => q.trim()) : null,
        status: 'awaiting_kickoff',
        current_members_count: 1,
      });

      Alert.alert('🎉 Success!', 'Your pursuit has been created!', [
        { text: 'OK', onPress: () => {
          // Reset form
          setTitle('');
          setDescription('');
          setTeamSizeMin('2');
          setTeamSizeMax('8');
          setTeamSizeFlexible(false);
          setLocation('');
          setProjectedDuration('');
          setSelectedTypes([]);
          setCategories('');
          setOwnershipStructure('');
          setDecisionSystem('Standard Vote');
          setDecisionNote('');
          setMeetingCadence('');
          setMeetingNote('');
          setAttendanceStyle('Mandatory');
          setAttendanceNote('');
          setAccountabilityMechanics('');
          setRoles('');
          setExperienceLevel('');
          setCurrentStage('');
          setAgeRestriction('');
          setContinueAccepting(false);
          setRequiresInterview(false);
          setRequiresResume(false);
          setApplicationQuestions('');
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Modern Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Create a</Text>
          <Text style={styles.headerTitle}>Pursuit</Text>
        </View>
        <Text style={styles.subtitle}>* = Required</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          
          {/* BASIC INFORMATION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Basic Information</Text>
            
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Learn Java Programming Together"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Description * (min 50 characters)</Text>
            <Text style={styles.charCount}>{description.length}/50</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your pursuit, who you're looking for, and where you want it to go. Be specific!"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
            />

            <Text style={styles.label}>Team Size Range *</Text>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.miniLabel}>Min</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  value={teamSizeMin}
                  onChangeText={setTeamSizeMin}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.miniLabel}>Max</Text>
                <TextInput
                  style={styles.input}
                  placeholder="8"
                  value={teamSizeMax}
                  onChangeText={setTeamSizeMax}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Team size flexible?</Text>
              <Switch value={teamSizeFlexible} onValueChange={setTeamSizeFlexible} />
            </View>

            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              placeholder="Remote, New York, Hybrid"
              value={location}
              onChangeText={setLocation}
            />

            <Text style={styles.label}>Projected Duration (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 3 months, 1 year, ongoing"
              value={projectedDuration}
              onChangeText={setProjectedDuration}
            />
          </View>

          {/* PURSUIT TYPE */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 Pursuit Type * (Select 1-3)</Text>
            <Text style={styles.hint}>Selected: {selectedTypes.length}/3</Text>
            <View style={styles.chipContainer}>
              {PURSUIT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, selectedTypes.includes(type) && styles.chipSelected]}
                  onPress={() => toggleType(type)}
                >
                  <Text style={[styles.chipText, selectedTypes.includes(type) && styles.chipTextSelected]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* CATEGORIES */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏷️ Categories (optional, up to 5)</Text>
            <Text style={styles.hint}>Comma-separated (e.g., tech, basketball, pokemon)</Text>
            <TextInput
              style={styles.input}
              placeholder="tech, basketball, pokemon"
              value={categories}
              onChangeText={setCategories}
            />
          </View>

          {/* BUSINESS-SPECIFIC */}
          {selectedTypes.includes('Business') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💼 Business Details</Text>
              <Text style={styles.label}>Ownership Structure</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Distributed evenly, Admin owns 90%"
                value={ownershipStructure}
                onChangeText={setOwnershipStructure}
              />
            </View>
          )}

          {/* DECISION SYSTEM */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🗳️ Decision System *</Text>
            <View style={styles.chipContainer}>
              {DECISION_SYSTEMS.map((system) => (
                <TouchableOpacity
                  key={system}
                  style={[styles.chip, decisionSystem === system && styles.chipSelected]}
                  onPress={() => setDecisionSystem(system)}
                >
                  <Text style={[styles.chipText, decisionSystem === system && styles.chipTextSelected]}>
                    {system}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Add a note about your decision system (optional)"
              value={decisionNote}
              onChangeText={setDecisionNote}
            />
          </View>

          {/* MEETING DETAILS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Meeting Details</Text>
            
            <Text style={styles.label}>Meeting Cadence *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Weekly on Mondays at 7pm"
              value={meetingCadence}
              onChangeText={setMeetingCadence}
            />
            <TextInput
              style={styles.input}
              placeholder="Add a note (optional)"
              value={meetingNote}
              onChangeText={setMeetingNote}
            />

            <Text style={styles.label}>Attendance Style *</Text>
            <View style={styles.chipContainer}>
              {ATTENDANCE_STYLES.map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[styles.chip, attendanceStyle === style && styles.chipSelected]}
                  onPress={() => setAttendanceStyle(style)}
                >
                  <Text style={[styles.chipText, attendanceStyle === style && styles.chipTextSelected]}>
                    {style}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Set expectations for attendance (optional)"
              value={attendanceNote}
              onChangeText={setAttendanceNote}
            />
          </View>

          {/* ACCOUNTABILITY */}
          {selectedTypes.includes('Accountability') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>✅ Accountability Mechanics</Text>
              <Text style={styles.hint}>Comma-separated (e.g., streaks, check-ins, contributions)</Text>
              <TextInput
                style={styles.input}
                placeholder="streaks, check-ins, tasks complete"
                value={accountabilityMechanics}
                onChangeText={setAccountabilityMechanics}
              />
            </View>
          )}

          {/* ROLES & EXPERIENCE */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Roles & Experience (optional)</Text>
            
            <Text style={styles.label}>Roles</Text>
            <Text style={styles.hint}>Comma-separated roles you're looking for</Text>
            <TextInput
              style={styles.input}
              placeholder="Developer, Designer, Marketing Lead"
              value={roles}
              onChangeText={setRoles}
            />

            <Text style={styles.label}>Experience Level</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5+ years, Beginner, Intermediate"
              value={experienceLevel}
              onChangeText={setExperienceLevel}
            />

            <Text style={styles.label}>Current Stage in Process</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Just starting, Have a prototype"
              value={currentStage}
              onChangeText={setCurrentStage}
            />
          </View>

          {/* RESTRICTIONS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔒 Restrictions (optional)</Text>
            <Text style={styles.label}>Age Restriction</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 18+, 21+ for cocktails, Students only"
              value={ageRestriction}
              onChangeText={setAgeRestriction}
            />
          </View>

          {/* APPLICATION SETTINGS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Application Settings</Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.label}>Continue accepting after kickoff?</Text>
              <Switch value={continueAccepting} onValueChange={setContinueAccepting} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Require interview?</Text>
              <Switch value={requiresInterview} onValueChange={setRequiresInterview} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Require resume?</Text>
              <Switch value={requiresResume} onValueChange={setRequiresResume} />
            </View>

            <Text style={styles.label}>Application Questions (optional)</Text>
            <Text style={styles.hint}>One question per line</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Why are you a good team fit?&#10;Where do you hope to see this go?"
              value={applicationQuestions}
              onChangeText={setApplicationQuestions}
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '🚀 Creating...' : '✨ Create Pursuit'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header Styles
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    ...shadows.sm,
  },

  headerGreeting: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },

  headerTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },

  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },

  scrollView: {
    flex: 1,
  },

  form: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },

  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.base,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.base,
  },

  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  miniLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },

  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },

  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  halfInput: {
    flex: 1,
  },

  hint: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },

  charCount: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'right',
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },

  chipTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    alignItems: 'center',
    ...shadows.lg,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
