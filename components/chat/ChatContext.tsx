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
import { useTripGroupChat } from '@/hooks/useTripGroupChat'
import { Trip, TripGroupMessage } from '@/types'

interface ChatContextValue {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
  unreadCount: number
  messages: TripGroupMessage[]
  sendMessage: (content: string) => Promise<void>
  markAsRead: () => void
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
  sendMessage: async () => {},
  markAsRead: () => {},
  loading: false,
  currentTripId: null,
  currentTripName: null,
  userId: null,
})

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const { currentTrip: tripsCurrentTrip, userId } = useTrips()

  // Overstyr currentTrip når andre useTrips-instanser bytter tur (f.eks. fra en side)
  // trip-changed-eventet sendes fra setCurrentTrip-wrapperen i useTrips.ts
  const [tripOverride, setTripOverride] = useState<Trip | null | undefined>(undefined)

  useEffect(() => {
    function onTripChanged(e: Event) {
      const { trip } = (e as CustomEvent<{ trip: Trip | null }>).detail
      setTripOverride(trip)
    }
    window.addEventListener('trip-changed', onTripChanged)
    return () => window.removeEventListener('trip-changed', onTripChanged)
  }, [])

  // tripOverride === undefined betyr at ingen event har kommet ennå → bruk verdi fra useTrips()
  const currentTrip = tripOverride !== undefined ? tripOverride : tripsCurrentTrip

  const tripId = currentTrip?.id ?? null
  const tripName = currentTrip?.name ?? null

  const { messages, sendMessage, unreadCount, markAsRead, loading } =
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
      markAsRead,
      loading,
      currentTripId: tripId,
      currentTripName: tripName,
      userId,
    }),
    [isOpen, toggle, open, close, unreadCount, messages, sendMessage, markAsRead, loading, tripId, tripName, userId]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  return useContext(ChatContext)
}
