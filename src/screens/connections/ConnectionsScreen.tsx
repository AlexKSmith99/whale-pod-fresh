import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { connectionService } from 
'../../services/connectionService';

export default function ConnectionsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'connections' | 
'pending'>('connections');
  const [connections, setConnections] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = 
useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [connectionsData, pendingData, sentData] = await 
Promise.all([
        connectionService.getMyConnections(user.id),
        connectionService.getPendingRequests(user.id),
        connectionService.getSentRequests(user.id),
      ]);

      setConnections(connectionsData);
      setPendingRequests(pendingData);
      setSentRequests(sentData);
    } catch (error: any) {
      console.error('Error loading connections:', error);
      Alert.alert('Error', 'Failed to load connections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (connectionId: string) => {
    try {
      await connectionService.acceptConnection(connectionId);
      Alert.alert('Success', 'Connection request accepted!');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleReject = async (connectionId: string) => {
    try {
      await connectionService.rejectConnection(connectionId);
      Alert.alert('Success', 'Connection request rejected');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} 
style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'connections' && 
styles.activeTab]}
          onPress={() => setActiveTab('connections')}
        >
          <Text style={[styles.tabText, activeTab === 
'connections' && styles.activeTabText]}>
            My Connections ({connections.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && 
styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && 
styles.activeTabText]}>
            Requests ({pendingRequests.length + 
sentRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} 
onRefresh={onRefresh} />}
      >
        {activeTab === 'connections' ? (
          <View style={styles.section}>
            {connections.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} 
color="#ccc" />
                <Text style={styles.emptyText}>No connections 
yet</Text>
                <Text style={styles.emptySubtext}>Connect with 
people you work with!</Text>
              </View>
            ) : (
              connections.map((connection) => (
                <TouchableOpacity
                  key={connection.id}
                  style={styles.connectionCard}
                  onPress={() => 
navigation.navigate('UserProfile', { userId: 
connection.otherUserId })}
                >
                  {connection.profile?.profile_picture ? (
                    <Image
                      source={{ uri: 
connection.profile.profile_picture }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        
{connection.profile?.name?.charAt(0).toUpperCase() ||
                         
connection.profile?.email?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>
                      {connection.profile?.name || 
connection.profile?.email?.split('@')[0] || 'Unknown'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} 
color="#999" />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {pendingRequests.length === 0 && sentRequests.length 
=== 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} 
color="#ccc" />
                <Text style={styles.emptyText}>No pending 
requests</Text>
              </View>
            ) : (
              <>
                {pendingRequests.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Received 
Requests</Text>
                    {pendingRequests.map((request) => (
                      <View key={request.id} 
style={styles.requestCard}>
                        <TouchableOpacity
                          style={styles.requestInfo}
                          onPress={() => 
navigation.navigate('UserProfile', { userId: request.user_id_1 })}
                        >
                          {request.profile?.profile_picture ? (
                            <Image
                              source={{ uri: 
request.profile.profile_picture }}
                              style={styles.avatar}
                            />
                          ) : (
                            <View style={styles.avatar}>
                              <Text style={styles.avatarText}>
                                
{request.profile?.name?.charAt(0).toUpperCase() ||
                                 
request.profile?.email?.charAt(0).toUpperCase() || '?'}
                              </Text>
                            </View>
                          )}
                          <View style={styles.requestDetails}>
                            <Text style={styles.requestName}>
                              {request.profile?.name || 
request.profile?.email?.split('@')[0] || 'Unknown'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => 
handleAccept(request.id)}
                          >
                            <Text 
style={styles.acceptButtonText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() => 
handleReject(request.id)}
                          >
                            <Text 
style={styles.rejectButtonText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {sentRequests.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { 
marginTop: pendingRequests.length > 0 ? 20 : 0 }]}>
                      Sent Requests
                    </Text>
                    {sentRequests.map((request) => (
                      <TouchableOpacity
                        key={request.id}
                        style={styles.sentRequestCard}
                        onPress={() => 
navigation.navigate('UserProfile', { userId: request.user_id_2 })}
                      >
                        {request.profile?.profile_picture ? (
                          <Image
                            source={{ uri: 
request.profile.profile_picture }}
                            style={styles.avatar}
                          />
                        ) : (
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              
{request.profile?.name?.charAt(0).toUpperCase() ||
                               
request.profile?.email?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.connectionInfo}>
                          <Text style={styles.connectionName}>
                            {request.profile?.name || 
request.profile?.email?.split('@')[0] || 'Unknown'}
                          </Text>
                          <Text 
style={styles.sentStatus}>Pending...</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} 
color="#999" />
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#0ea5e9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  requestCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sentRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sentStatus: {
    fontSize: 13,
    color: '#f59e0b',
    fontStyle: 'italic',
  },
});
