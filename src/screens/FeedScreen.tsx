import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { pursuitService } from '../services/pursuitService';
import { useAuth } from '../contexts/AuthContext';
import PursuitDetailScreen from './PursuitDetailScreen';

interface Props {
  onStartMessage?: (userId: string, userEmail: string) => void;
  onOpenTeamBoard?: (pursuitId: string) => void;
  onOpenMeetingNotes?: (pursuitId: string) => void;
  onOpenCreate?: () => void;
}

export default function FeedScreen({ onStartMessage, onOpenTeamBoard, onOpenMeetingNotes, onOpenCreate }: Props) {
  const { user } = useAuth();
  const [pursuits, setPursuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPursuit, setSelectedPursuit] = useState<any>(null);

  useEffect(() => {
    loadPursuits();
  }, []);

  const loadPursuits = async () => {
    try {
      const data = await pursuitService.getPursuits();
      setPursuits(data);
    } catch (error) {
      console.error('Error loading pursuits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Pursuit',
      'Are you sure you want to delete this pursuit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await pursuitService.deletePursuit(selectedPursuit.id);
              setSelectedPursuit(null);
              loadPursuits();
              Alert.alert('Success', 'Pursuit deleted!');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (selectedPursuit) {
    return (
      <PursuitDetailScreen
        pursuit={selectedPursuit}
        onBack={() => setSelectedPursuit(null)}
        onDelete={handleDelete}
        isOwner={selectedPursuit.creator_id === user?.id}
        onViewProfile={(userId, userEmail) => {
          // Profile viewing is handled within PursuitDetailScreen now
        }}
        onSendMessage={(userId, userEmail) => {
          setSelectedPursuit(null);
          if (onStartMessage) {
            onStartMessage(userId, userEmail);
          }
        }}
        onOpenTeamBoard={(pursuitId) => {
          setSelectedPursuit(null);
          if (onOpenTeamBoard) {
            onOpenTeamBoard(pursuitId);
          }
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🐋 Whale Pod</Text>
          <Text style={styles.subtitle}>Discover Pursuits</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={onOpenCreate}>
          <Text style={styles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadPursuits} />
        }
      >
        <View style={styles.content}>
          {pursuits.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌊</Text>
              <Text style={styles.emptyText}>No pursuits yet!</Text>
              <Text style={styles.emptyHint}>Tap "+ Create" to start your first pursuit</Text>
            </View>
          ) : (
            pursuits.map((pursuit) => (
              <TouchableOpacity 
                key={pursuit.id} 
                style={styles.card}
                onPress={() => setSelectedPursuit(pursuit)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{pursuit.title}</Text>
                    {pursuit.creator_id === user?.id && (
                      <View style={styles.ownerBadge}>
                        <Text style={styles.ownerBadgeText}>YOURS</Text>
                      </View>
                    )}
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    pursuit.status === 'active' ? styles.statusActive : styles.statusPending
                  ]}>
                    <Text style={styles.statusText}>
                      {pursuit.status === 'awaiting_kickoff' ? 'Awaiting Kickoff' : 'Active'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDescription} numberOfLines={2}>
                  {pursuit.description}
                </Text>

                <View style={styles.cardInfo}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>📍</Text>
                    <Text style={styles.infoText}>{pursuit.location}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>👥</Text>
                    <Text style={styles.infoText}>
                      {pursuit.current_members_count}/{pursuit.team_size_max}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>📅</Text>
                    <Text style={styles.infoText} numberOfLines={1}>
                      {pursuit.meeting_cadence}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.tapHint}>Tap for details →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0ea5e9' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  createButton: { backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 5 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  content: { padding: 15, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#999', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#ccc', textAlign: 'center', paddingHorizontal: 40 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 19, fontWeight: 'bold', color: '#1a1a1a', flex: 1, marginRight: 8 },
  ownerBadge: { backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ownerBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusPending: { backgroundColor: '#fef3c7' },
  statusActive: { backgroundColor: '#d1fae5' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#333' },
  cardDescription: { fontSize: 14, color: '#666', marginBottom: 14, lineHeight: 20 },
  cardInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  infoIcon: { fontSize: 14, marginRight: 6 },
  infoText: { fontSize: 13, color: '#666', maxWidth: 100 },
  cardFooter: { alignItems: 'flex-end' },
  tapHint: { fontSize: 12, color: '#0ea5e9', fontWeight: '600' },
});
