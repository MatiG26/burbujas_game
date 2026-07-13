export interface SawEntity {
  id: string
  playerId: string
  username: string
  avatarUrl: string
  entityType: 'standard' | 'comment'
  specialMode?: 'confetti' | 'boxing'
  specialPhase?: 'showcase' | 'plunge'
  specialPhaseStartedAt?: number
  specialModeUntil?: number
  invulnerableUntil?: number
  commentText?: string
  touchesRemaining?: number
  hp: number
  maxHp: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  rotation: number
  isPrimary: boolean
  hue: number
  lastDamageAt: number
  isTouching?: boolean
}

export type GiftAction = 'boost' | 'split' | 'comment' | 'confetti' | 'boxing'

export interface DonationEvent {
  username: string
  avatarUrl: string
  hpDelta: number
  sourceLabel: string
  sourceImageUrl?: string
  action: GiftAction
  commentText?: string
  quantity: number
  timestamp: number
}

export interface GiftConfig {
  id: string
  giftName: string
  imageUrl: string
  hpReward: number
  action: GiftAction
  enabled: boolean
}

export interface CanvasSize {
  width: number
  height: number
}

export interface LeaderboardEntry {
  id: string
  username: string
  avatarUrl: string
  totalDonated: number
  currentHp: number
  sawCount: number
  isActive: boolean
}

export interface ActiveSawSummary {
  id: string
  playerId: string
  username: string
  avatarUrl: string
  entityType: 'standard' | 'comment'
  commentText?: string
  touchesRemaining?: number
  hp: number
  maxHp: number
  radius: number
  isPrimary: boolean
}

export interface DespawnEffect {
  id: string
  x: number
  y: number
  radius: number
  hue: number
  startedAt: number
  duration: number
}

export interface LiveGiftEvent {
  username: string
  avatarUrl: string
  eventType?: 'gift' | 'like' | 'comment'
  giftName: string
  giftImageUrl: string
  commentText?: string
  repeatCount: number
  giftId: string
  timestamp: number
}

export type TikTokConnectionState = 'idle' | 'connecting' | 'connected' | 'error'

export interface TikTokBridgeStatus {
  state: TikTokConnectionState
  uniqueId: string
  message: string
  roomId?: string
}

export interface BridgeStatusMessage {
  type: 'status'
  payload: TikTokBridgeStatus
}

export interface BridgeGiftMessage {
  type: 'gift'
  payload: LiveGiftEvent
}

export interface BridgeCommandMessage {
  type: 'connect' | 'disconnect'
  payload?: {
    uniqueId?: string
  }
}

export interface GiftApplicationResult {
  applied: boolean
  reason?: string
}