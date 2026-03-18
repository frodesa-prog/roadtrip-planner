'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useTripGroupChat, ReadReceipts } from '@/hooks/useTripGroupChat'
import { Trip, TripGroupMessage } from '@/types'

interface ChatContextValue {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
  unreadCount: number
  messages: TripGroupMessage[]
  sendMessage: (content: string, file?: File) => Promise<void>
  deleteMessage: (messageId: string, attachmentUrl?: string | null) => Promise<void>
  clearChat: () => Promise<boolean>
  archiveAndClear: (name: string) => Promise<boolean>
  markAsRead: () => void
  readReceipts: ReadReceipts
  loading: boolean
  currentTripId: string | null
  currentTripName: string | null
  userId: string | null
}

const ChatContext = createContext<ChatContextValue>({
  isOpen: false,
  toggle: () => {},
  open: () => {},
  close: () => {},
  unreadCount: 0,
  messages: [],
  sendMessage: async (_content: string, _file?: File) => {},
  deleteMessage: async () => {},
  clearChat: async () => false,
  archiveAndClear: async () => false,
  markAsRead: () => {},
  readReceipts: {},
  loading: false,
  currentTripId: null,
  currentTripName: null,
  userId: null,
})

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const { currentTrip: tripsCurrentTrip, userId } = useTrips()

  // Overstyr currentTrip når andre useTrips-instanser bytter tur (f.eks. fra en side)
  const [tripOverride, setTripOverride] = useState<Trip | null | undefined>(undefined)

  useEffect(() => {
    function onTripChanged(e: Event) {
      const { trip } = (e as CustomEvent<{ trip: Trip | null }>).detail
      setTripOverride(trip)
    }
    window.addEventListener('trip-changed', onTripChanged)
    return () => window.removeEventListener('trip-changed', onTripChanged)
  }, [])

  const currentTrip = tripOverride !== undefined ? tripOverride : tripsCurrentTrip
  const tripId = currentTrip?.id ?? null
  const tripName = currentTrip?.name ?? null

  const { messages, sendMessage, deleteMessage, clearChat, archiveAndClear, unreadCount, markAsRead, readReceipts, loading } =
    useTripGroupChat(tripId, userId)

  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo<ChatContextValue>(
    () => ({
      isOpen,
      toggle,
      open,
      close,
      unreadCount,
      messages,
      sendMessage,
      deleteMessage,
      clearChat,
      archiveAndClear,
      markAsRead,
      readReceipts,
      loading,
      currentTripId: tripId,
      currentTripName: tripName,
      userId,
    }),
    [isOpen, toggle, open, close, unreadCount, messages, sendMessage, deleteMessage, clearChat, archiveAndClear, markAsRead, readReceipts, loading, tripId, tripName, userId]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  return useContext(ChatContext)
}
