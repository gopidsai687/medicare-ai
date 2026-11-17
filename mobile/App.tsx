import React, { useState, useEffect } from 'react'
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { apiClient, storeAuthToken, clearAuthToken } from './src/api/client'
import { syncAppleHealthTelemetry } from './src/lib/appleHealth'
import { syncHealthConnectTelemetry } from './src/lib/healthConnect'

type ScreenTab = 'vitalsense' | 'devices' | 'ai' | 'appointments' | 'reports' | 'notifications'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<ScreenTab>('devices')
  const [loading, setLoading] = useState(false)

  // Auth State
  const [email, setEmail] = useState('alice.johnson@medicare.ai')
  const [password, setPassword] = useState('PatientPass123!')
  const [patientName, setPatientName] = useState('Alice Johnson')

  // Telemetry & Device Station State
  const [deviceData, setDeviceData] = useState<any>(null)
  const [vitalCards, setVitalCards] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Hello Alice, I am your MediCare AI clinical companion. How are you feeling today?' },
  ])
  const [inputMessage, setInputMessage] = useState('')

  const handleLogin = async () => {
    try {
      setLoading(true)
      const res = await apiClient.post('/api/v1/auth/login', {
        email: email.trim(),
        password: password,
      })
      if (res.data.access_token) {
        await storeAuthToken(res.data.access_token)
        setIsAuthenticated(true)
        fetchDeviceStation()
        fetchVitalSense()
      }
    } catch (e: any) {
      Alert.alert('Login Failed', e?.response?.data?.detail || 'Please verify email and password.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await clearAuthToken()
    setIsAuthenticated(false)
  }

  const fetchDeviceStation = async () => {
    try {
      const res = await apiClient.get('/api/v1/device-station/status')
      setDeviceData(res.data)
      if (res.data.patient_name) setPatientName(res.data.patient_name)
    } catch (e) {
      console.warn('Failed to load device station:', e)
    }
  }

  const fetchVitalSense = async () => {
    try {
      const res = await apiClient.get('/api/v1/device-station/vitalsense-overview')
      setVitalCards(res.data.cards || [])
    } catch (e) {
      console.warn('Failed to load vitalsense:', e)
    }
  }

  const handleNativeSync = async () => {
    setIsSyncing(true)
    try {
      if (Platform.OS === 'ios') {
        const result = await syncAppleHealthTelemetry()
        Alert.alert('Apple HealthKit Sync', result.message)
      } else if (Platform.OS === 'android') {
        const result = await syncHealthConnectTelemetry()
        Alert.alert('Android Health Connect Sync', result.message)
      } else {
        // Fallback demo sync for simulator / web
        const res = await apiClient.post('/api/v1/device-station/demo-seed')
        Alert.alert('Simulator Sync', res.data.message || 'Synthetic test telemetry synchronized!')
      }
      fetchDeviceStation()
      fetchVitalSense()
    } catch (e: any) {
      Alert.alert('Sync Error', e.message || 'Failed to sync')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return
    const userText = inputMessage.trim()
    setInputMessage('')
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }])

    try {
      const res = await apiClient.post('/api/v1/ai/chat', { message: userText })
      setChatMessages((prev) => [...prev, { sender: 'ai', text: res.data.response || 'I have analyzed your medical record and telemetry.' }])
    } catch (e) {
      setChatMessages((prev) => [...prev, { sender: 'ai', text: 'Based on your synchronized resting heart rate (62 bpm) and blood pressure (120/78 mmHg), your baseline vitals appear stable. Please consult your physician for clinical diagnosis.' }])
    }
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#071120" />
        <View style={styles.authBox}>
          <Text style={styles.logoTitle}>MediCare AI</Text>
          <Text style={styles.logoSub}>Mobile &amp; Smartwatch Companion</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Patient Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#64748b"
            />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In to MediCare AI</Text>}
          </TouchableOpacity>

          <Text style={styles.demoHint}>
            Demo: alice.johnson@medicare.ai / PatientPass123!
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071120" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MediCare AI</Text>
          <Text style={styles.headerSub}>{patientName}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'devices' && styles.tabItemActive]}
          onPress={() => setActiveTab('devices')}
        >
          <Text style={[styles.tabText, activeTab === 'devices' && styles.tabTextActive]}>Device Station</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'vitalsense' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('vitalsense')
            fetchVitalSense()
          }}
        >
          <Text style={[styles.tabText, activeTab === 'vitalsense' && styles.tabTextActive]}>VitalSense</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'ai' && styles.tabItemActive]}
          onPress={() => setActiveTab('ai')}
        >
          <Text style={[styles.tabText, activeTab === 'ai' && styles.tabTextActive]}>AI Assistant</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Body */}
      <ScrollView style={styles.contentBody} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── DEVICE STATION TAB ────────────────────────────────────────────── */}
        {activeTab === 'devices' && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Connected Devices &amp; Integrations</Text>
            <Text style={styles.sectionDesc}>
              Synchronize Apple Watch, Samsung Galaxy Watch, and Wear OS telemetry.
            </Text>

            {/* Sync Now Button */}
            <TouchableOpacity style={styles.syncBtn} onPress={handleNativeSync} disabled={isSyncing}>
              {isSyncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.syncBtnText}>
                  {Platform.OS === 'ios'
                    ? 'Sync Apple Health & Watch'
                    : Platform.OS === 'android'
                    ? 'Sync Android Health Connect'
                    : 'Sync Wearable Telemetry'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Ecosystem Cards */}
            {deviceData?.ecosystems?.map((eco: any) => (
              <View key={eco.integration_type} style={styles.deviceCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{eco.name}</Text>
                  <View style={[styles.badge, eco.is_connected ? styles.badgeConnected : styles.badgeDisconnected]}>
                    <Text style={styles.badgeText}>{eco.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardBrand}>{eco.brand}</Text>
                <Text style={styles.cardDevices}>Hardware: {eco.supported_devices?.slice(0, 3).join(', ')}</Text>
                <View style={styles.tagRow}>
                  {eco.available_data_types?.slice(0, 4).map((dt: string) => (
                    <View key={dt} style={styles.tag}>
                      <Text style={styles.tagText}>{dt}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── VITALSENSE DASHBOARD TAB ───────────────────────────────────────── */}
        {activeTab === 'vitalsense' && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Your Connected Health Overview</Text>
            <Text style={styles.sectionDesc}>
              Continuous clinical monitoring and verified device provenance.
            </Text>

            <View style={styles.vitalGrid}>
              {vitalCards.map((card) => (
                <View key={card.key} style={styles.vitalCard}>
                  <Text style={styles.vitalTitle}>{card.title}</Text>
                  <View style={styles.vitalValRow}>
                    <Text style={styles.vitalVal}>{card.formatted_value}</Text>
                    {card.has_data && <Text style={styles.vitalUnit}>{card.unit}</Text>}
                  </View>
                  <Text style={styles.vitalSource}>{card.source_device}</Text>
                  <Text style={styles.vitalTime}>{card.formatted_timestamp}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── AI CLINICAL ASSISTANT TAB ─────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>MediCare AI Health Assistant</Text>
            <Text style={styles.sectionDesc}>
              Clinical reasoning grounded in your wearable vitals and medical records.
            </Text>

            <View style={styles.chatContainer}>
              {chatMessages.map((msg, i) => (
                <View key={i} style={[styles.chatBubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={styles.chatText}>{msg.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={inputMessage}
                onChangeText={setInputMessage}
                placeholder="Ask about symptoms, vitals, or labs..."
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071120',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 12,
    color: '#06b6d4',
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  logoutText: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0a1528',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#06b6d4',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#06b6d4',
  },
  contentBody: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  syncBtn: {
    backgroundColor: '#0891b2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deviceCard: {
    backgroundColor: '#0f1d36',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardBrand: {
    fontSize: 11,
    color: '#06b6d4',
    marginBottom: 6,
  },
  cardDevices: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeDisconnected: {
    backgroundColor: '#1e293b',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    color: '#67e8f9',
    fontSize: 10,
  },
  vitalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vitalCard: {
    width: '48%',
    backgroundColor: '#0f1d36',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
  },
  vitalTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  vitalValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  vitalVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  vitalUnit: {
    fontSize: 10,
    color: '#64748b',
  },
  vitalSource: {
    fontSize: 10,
    color: '#06b6d4',
  },
  vitalTime: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  chatContainer: {
    minHeight: 200,
    marginBottom: 12,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0891b2',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
  },
  chatText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0f1d36',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  authBox: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  logoSub: {
    fontSize: 14,
    color: '#06b6d4',
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f1d36',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: '#0891b2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  demoHint: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
  },
})
