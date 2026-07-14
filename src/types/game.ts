export interface SawEntity {
  id: string
  playerId: string
  username: string
  avatarUrl: string
  entityType: 'standard' | 'comment'
  specialMode?: 'confetti' | 'boxing' | 'lion'
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

export type GiftAction = 'boost' | 'split' | 'comment' | 'confetti' | 'boxing' | 'lion'

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

export interface RoundWinnerSummary {
  playerId: string
  username: string
  avatarUrl: string
  hp: number
  survivedMs: number
  wonAt: number
}

export interface RoundStatus {
  isActive: boolean
  participantCount: number
  remainingMs: number
  startedAt: number | null
  lastWinner: RoundWinnerSummary | null
  showcaseWinner: RoundWinnerSummary | null
}

export interface SharedRoundState {
  startedAt: number | null
  endsAt: number | null
  winnerShowcaseUntil: number | null
  winnerEntityId: string | null
  lastWinner: RoundWinnerSummary | null
  showcaseWinner: RoundWinnerSummary | null
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

export interface SharedAppState {
  username: string
  avatarUrl: string
  tiktokLiveId: string
  giftConfigs: GiftConfig[]
}

export interface SharedGameState {
  entities: SawEntity[]
  leaderboard: LeaderboardEntry[]
  recentEvents: DonationEvent[]
  donationHistory: DonationEvent[]
  roundState?: SharedRoundState
}

export type SharedAppMessage =
  | {
    kind: 'manual-donation'
    sourceId: string
    event: DonationEvent
  }
  | {
    kind: 'state-request'
    sourceId: string
  }
  | {
    kind: 'game-state-request'
    sourceId: string
  }
  | {
    kind: 'state-snapshot'
    sourceId: string
    state: SharedAppState
  }
  | {
    kind: 'game-state-snapshot'
    sourceId: string
    state: SharedGameState
  }
  | {
    kind: 'reset-game'
    sourceId: string
  }

export interface BridgeCommandTransportMessage {
  type: 'bridge-command'
  payload: BridgeCommandMessage
}

export interface AppSyncTransportMessage {
  type: 'app-sync'
  payload: SharedAppMessage
}

export type LocalBridgeSocketMessage =
  | BridgeGiftMessage
  | BridgeStatusMessage
  | BridgeCommandTransportMessage
  | AppSyncTransportMessage

export interface GiftApplicationResult {
  applied: boolean
  reason?: string
}