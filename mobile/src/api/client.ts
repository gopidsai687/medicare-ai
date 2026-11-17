import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Points to live Render backend by default or local development port
export const API_BASE_URL = 'https://medicare-ai-iv31.onrender.com'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT access token to every outgoing request
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('medicare_access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (e) {
      console.warn('Failed to load token from AsyncStorage:', e)
    }
    return config
  },
  (error) => Promise.reject(error)
)

export const storeAuthToken = async (token: string) => {
  await AsyncStorage.setItem('medicare_access_token', token)
}

export const clearAuthToken = async () => {
  await AsyncStorage.removeItem('medicare_access_token')
}
