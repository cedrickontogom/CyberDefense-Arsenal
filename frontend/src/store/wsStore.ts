import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

export interface WSMessage {
  type: string
  payload: any
}

export interface AlertNotification {
  id: string
  alert_id: string
  title: string
  severity: string
  status: string
  connector: string
  host: string
  user: string
  source_ip: string
  occurred_at: string
  received_at: string
}

export interface CaseNotification {
  id: string
  title: string
  status: string
  severity: string
  assignee: string
}

export interface WSState {
  socket: Socket | null
  isConnected: boolean
  unreadCount: number
  notifications: WSMessage[]
  alertNotifications: AlertNotification[]
  caseNotifications: CaseNotification[]

  // Actions
  connect: (token: string) => void
  disconnect: () => void
  send: (message: WSMessage) => void
  subscribe: (channel: string, filters?: any) => void
  unsubscribe: (channel: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  addNotification: (notification: WSMessage) => void
}

export const useWebSocketStore = create<WSState>((set, get) => ({
  socket: null,
  isConnected: false,
  unreadCount: 0,
  notifications: [],
  alertNotifications: [],
  caseNotifications: [],

  connect: (token) => {
    const { socket } = get()
    if (socket?.connected) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    newSocket.on('connect', () => {
      set({ isConnected: true })
      console.log('WebSocket connected')
    })

    newSocket.on('disconnect', (reason) => {
      set({ isConnected: false })
      console.log('WebSocket disconnected:', reason)
    })

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
    })

    newSocket.on('alert_created', (data: AlertNotification) => {
      get().addNotification({
        type: 'alert_created',
        payload: data,
      })
      set((state) => ({
        alertNotifications: [data, ...state.alertNotifications].slice(0, 100),
        unreadCount: state.unreadCount + 1,
      }))
    })

    newSocket.on('alert_updated', (data: any) => {
      get().addNotification({
        type: 'alert_updated',
        payload: data,
      })
    })

    newSocket.on('case_created', (data: CaseNotification) => {
      get().addNotification({
        type: 'case_created',
        payload: data,
      })
      set((state) => ({
        caseNotifications: [data, ...state.caseNotifications].slice(0, 100),
        unreadCount: state.unreadCount + 1,
      }))
    })

    newSocket.on('case_updated', (data: any) => {
      get().addNotification({
        type: 'case_updated',
        payload: data,
      })
    })

    newSocket.on('scan_update', (data: any) => {
      get().addNotification({
        type: 'scan_update',
        payload: data,
      })
    })

    newSocket.on('stats_update', (data: any) => {
      get().addNotification({
        type: 'stats_update',
        payload: data,
      })
    })

    set({ socket: newSocket })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },

  send: (message) => {
    const { socket } = get()
    if (socket?.connected) {
      socket.emit('message', message)
    }
  },

  subscribe: (channel, filters) => {
    const { socket } = get()
    if (socket?.connected) {
      socket.emit('subscribe', { channel, filters })
    }
  },

  unsubscribe: (channel) => {
    const { socket } = get()
    if (socket?.connected) {
      socket.emit('unsubscribe', { channel })
    }
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n, i) => i !== id),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllNotificationsRead: () => {
    set({ notifications: [], unreadCount: 0 })
  },

  clearNotifications: () => {
    set({ notifications: [], alertNotifications: [], caseNotifications: [], unreadCount: 0 })
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 200),
    }))
  },
}))

// Auto-connect when auth changes
if (typeof window !== 'undefined') {
  // Listen for auth changes
  const originalSetItem = localStorage.setItem
  localStorage.setItem = function(key, value) {
    if (key === 'auth-storage') {
      try {
        const authData = JSON.parse(value)
        if (authData.state?.accessToken) {
          useWebSocketStore.getState().connect(authData.state.accessToken)
        } else {
          useWebSocketStore.getState().disconnect()
        }
      } catch (e) {}
    }
    return originalSetItem.apply(this, arguments)
  }
}