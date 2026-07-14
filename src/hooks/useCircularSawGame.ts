import { useEffect, useRef, useState } from 'react'
import bubbleSpriteUrl from '../assets/burbuja.png'
import boxingGloveSpriteUrl from '../assets/guante_box.png'
import {
  bladeLength,
  defaultCanvasSize,
  minSawRadius,
  splitImpulse,
} from '../game/constants'
import {
  clamp,
  containInsideCanvas,
  createSpawnPosition,
  hpToRadius,
  radiusToBladeCount,
  resolveCollision,
  updateMotion,
} from '../game/physics'
import type {
  ActiveSawSummary,
  CanvasSize,
  DespawnEffect,
  DonationEvent,
  GiftApplicationResult,
  LeaderboardEntry,
  RoundStatus,
  RoundWinnerSummary,
  SawEntity,
  SharedGameState,
  SharedRoundState,
} from '../types/game'

interface UseCircularSawGameResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  canvasSize: CanvasSize
  leaderboard: LeaderboardEntry[]
  activeSaws: ActiveSawSummary[]
  recentEvents: DonationEvent[]
  donationHistory: DonationEvent[]
  roundStatus: RoundStatus
  audioEnabled: boolean
  enableAudio: () => Promise<boolean>
  toggleAudio: () => Promise<boolean>
  resetGame: () => void
  donate: (event: DonationEvent) => GiftApplicationResult
  getSharedGameState: () => SharedGameState
  applySharedGameState: (state: SharedGameState) => void
}

interface ScreenOverlayEffect {
  id: string
  type: 'boxing-glove'
  donorName: string
  targetX?: number
  targetY?: number
  showDonorName?: boolean
  startedAt: number
  duration: number
}

interface NeedleBurstEffect {
  id: string
  x: number
  y: number
  hue: number
  startedAt: number
  duration: number
  lineCount: number
  radius: number
}

const maxRecentEvents = 6
const bubbleSprite = new Image()
bubbleSprite.src = bubbleSpriteUrl
const boxingGloveSprite = new Image()
boxingGloveSprite.src = boxingGloveSpriteUrl
const confettiShowcaseDuration = 2000
const confettiCycles = 2
const boxingEntryDuration = 950
const boxingStrikeDamage = 200
const maxBubbleEntities = 15
const lionBossHp = 10000
const lionBossRadius = 142
const roundDurationMs = 3 * 60 * 1000
const winnerShowcaseDurationMs = 5000

function playTransientAudio(audioEnabled: boolean, baseAudio: HTMLAudioElement | null) {
  if (!audioEnabled || !baseAudio) {
    return
  }

  const instance = baseAudio.cloneNode() as HTMLAudioElement
  instance.volume = baseAudio.volume
  const playPromise = instance.play()
  if (playPromise) {
    playPromise.catch(() => {})
  }
}

function formatHpValue(value: number) {
  if (value <= 0) {
    return '0'
  }

  if (value < 1) {
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  }

  if (Number.isInteger(value)) {
    return String(Math.round(value))
  }

  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function buildId(username: string) {
  return username.trim().toLowerCase().replace(/\s+/g, '-')
}

function createNewSaw(
  playerId: string,
  username: string,
  avatarUrl: string,
  hp: number,
  size: CanvasSize,
  isPrimary: boolean,
  hue: number,
  options?: {
    entityType?: 'standard' | 'comment'
    commentText?: string
    touchesRemaining?: number
    specialMode?: 'confetti' | 'boxing' | 'lion'
    specialPhase?: 'showcase' | 'plunge'
    specialPhaseStartedAt?: number
    specialModeUntil?: number
    invulnerableUntil?: number
  },
): SawEntity {
  const radius = hpToRadius(hp)
  const spawn = createSpawnPosition(size, radius)

  return {
    id: `${playerId}-${crypto.randomUUID()}`,
    playerId,
    username: username.trim(),
    avatarUrl: avatarUrl.trim(),
    entityType: options?.entityType ?? 'standard',
    specialMode: options?.specialMode,
    specialPhase: options?.specialPhase,
    specialPhaseStartedAt: options?.specialPhaseStartedAt,
    specialModeUntil: options?.specialModeUntil,
    invulnerableUntil: options?.invulnerableUntil,
    commentText: options?.commentText?.trim(),
    touchesRemaining: options?.touchesRemaining,
    hp,
    maxHp: hp,
    x: spawn.x,
    y: spawn.y,
    vx: (Math.random() - 0.5) * 260,
    vy: (Math.random() - 0.5) * 260,
    radius,
    rotation: Math.random() * Math.PI * 2,
    isPrimary,
    hue,
    lastDamageAt: 0,
    isTouching: false,
  }
}

function isSpecialActive(entity: SawEntity, now: number) {
  if (entity.specialMode === 'lion') {
    return true
  }

  return (entity.specialModeUntil ?? 0) > now
}

function isInvulnerable(entity: SawEntity, now: number) {
  return (entity.invulnerableUntil ?? 0) > now
}

function finishSpecialMode(entity: SawEntity) {
  entity.specialMode = undefined
  entity.specialPhase = undefined
  entity.specialPhaseStartedAt = undefined
  entity.specialModeUntil = undefined
  entity.invulnerableUntil = undefined
  entity.vx += (Math.random() - 0.5) * 180
  entity.vy += (Math.random() - 0.5) * 180
}

function normalizeImportedEntity(entity: SawEntity) {
  const nextEntity = { ...entity }

  // Los timestamps de modos especiales vienen del reloj local del dispositivo origen.
  // En otro dispositivo pueden dejar la animacion congelada, asi que se normalizan
  // a una burbuja comun manteniendo posicion, HP y avatar.
  if (nextEntity.specialMode === 'confetti' || nextEntity.specialMode === 'boxing') {
    nextEntity.specialMode = undefined
    nextEntity.specialPhase = undefined
    nextEntity.specialPhaseStartedAt = undefined
    nextEntity.specialModeUntil = undefined
    nextEntity.invulnerableUntil = undefined
    nextEntity.vx = nextEntity.vx || (Math.random() - 0.5) * 180
    nextEntity.vy = nextEntity.vy || (Math.random() - 0.5) * 180
  }

  if (nextEntity.specialMode === 'lion') {
    nextEntity.radius = lionBossRadius
  }

  nextEntity.isTouching = false
  return nextEntity
}

function getConfettiSpinDuration(entity: SawEntity) {
  return clamp(1200 + entity.radius * 4.4, 1200, 2400)
}

function updateSpecialMotion(entity: SawEntity, dt: number, now: number, size: CanvasSize) {
  if (!isSpecialActive(entity, now) || !entity.specialMode) {
    return false
  }

  if (entity.specialMode === 'lion') {
    entity.rotation += dt * 0.35
    entity.x = size.width * 0.5
    entity.y = size.height * 0.54
    entity.vx = 0
    entity.vy = 0
    entity.radius = lionBossRadius
    return true
  }

  if (entity.specialMode === 'confetti') {
    entity.x = size.width * 0.5
    entity.vx = 0
    entity.vy = 0

    if (entity.specialPhase === 'showcase') {
      entity.rotation += dt * 1.2
      entity.y = size.height * 0.5
      return true
    }

    const phaseStartedAt = entity.specialPhaseStartedAt ?? now
    const spinDuration = getConfettiSpinDuration(entity)
    const progress = clamp((now - phaseStartedAt) / spinDuration, 0, 1)
    const totalTurns = confettiCycles

    entity.y = size.height * 0.5
    entity.rotation = progress * Math.PI * 2 * totalTurns
    return true
  }

  entity.rotation += dt * 10
  entity.x = clamp(
    size.width * 0.5 + Math.sin(now / 120) * size.width * 0.08,
    entity.radius,
    size.width - entity.radius,
  )
  entity.y = clamp(
    size.height * 0.32 + Math.cos(now / 160) * size.height * 0.06,
    entity.radius,
    size.height - entity.radius,
  )
  entity.vx = 0
  entity.vy = 0
  return true
}

function drawBackground(ctx: CanvasRenderingContext2D, size: CanvasSize) {
  ctx.clearRect(0, 0, size.width, size.height)
}

function ensureAvatar(cache: Map<string, HTMLImageElement>, avatarUrl: string) {
  const normalizedUrl = avatarUrl.trim()
  if (!normalizedUrl || cache.has(normalizedUrl)) {
    return cache.get(normalizedUrl)
  }

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = normalizedUrl
  cache.set(normalizedUrl, image)
  return image
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  entity: SawEntity,
  image: HTMLImageElement | undefined,
  bodyRadius: number,
) {
  const avatarRadius = Math.max(22, bodyRadius * 0.52)
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, avatarRadius, 0, Math.PI * 2)
  ctx.clip()

  if (image && image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, -avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2)
  } else {
    ctx.fillStyle = `hsl(${entity.hue} 55% 48%)`
    ctx.fillRect(-avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = `${Math.max(12, avatarRadius * 0.62)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(entity.username.slice(0, 1).toUpperCase(), 0, avatarRadius * 0.08)
  }
  ctx.restore()
}

function drawSaw(
  ctx: CanvasRenderingContext2D,
  entity: SawEntity,
  imageCache: Map<string, HTMLImageElement>,
  size: CanvasSize,
  now: number,
) {
  const image = ensureAvatar(imageCache, entity.avatarUrl)
  const specialActive = isSpecialActive(entity, now)
  const renderScale = size.width > size.height ? 0.7 : 0.84
  const visualRadius = entity.radius * renderScale
  const bodyRadius = entity.entityType === 'comment'
    ? Math.max(42, visualRadius - bladeLength)
    : Math.max(28, visualRadius - bladeLength)

  ctx.save()
  ctx.translate(entity.x, entity.y)
  ctx.shadowBlur = specialActive ? 45 : 30
  ctx.shadowColor = entity.specialMode === 'confetti' && specialActive
    ? 'rgba(251, 191, 36, 0.55)'
    : entity.specialMode === 'boxing' && specialActive
      ? 'rgba(255,255,255,0.6)'
      : `hsla(${entity.hue} 90% 60% / 0.3)`

  if (entity.specialMode === 'confetti' && specialActive) {
    const glowGradient = ctx.createRadialGradient(0, 0, bodyRadius * 0.3, 0, 0, bodyRadius * 1.8)
    glowGradient.addColorStop(0, 'rgba(251, 191, 36, 0.65)')
    glowGradient.addColorStop(1, 'rgba(251, 191, 36, 0)')
    ctx.fillStyle = glowGradient
    ctx.beginPath()
    ctx.arc(0, 0, bodyRadius * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }

  if (entity.specialMode === 'boxing' && specialActive) {
    const glowGradient = ctx.createRadialGradient(0, 0, bodyRadius * 0.25, 0, 0, bodyRadius * 1.7)
    glowGradient.addColorStop(0, 'rgba(255,255,255,0.78)')
    glowGradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glowGradient
    ctx.beginPath()
    ctx.arc(0, 0, bodyRadius * 1.7, 0, Math.PI * 2)
    ctx.fill()
  }

  if (entity.specialMode === 'lion') {
    const glowGradient = ctx.createRadialGradient(0, 0, bodyRadius * 0.2, 0, 0, bodyRadius * 2.1)
    glowGradient.addColorStop(0, 'rgba(250, 204, 21, 0.88)')
    glowGradient.addColorStop(0.58, 'rgba(234, 179, 8, 0.34)')
    glowGradient.addColorStop(1, 'rgba(250, 204, 21, 0)')
    ctx.fillStyle = glowGradient
    ctx.beginPath()
    ctx.arc(0, 0, bodyRadius * 2.1, 0, Math.PI * 2)
    ctx.fill()
  }

  if (entity.entityType === 'standard') {
    ctx.save()
    ctx.rotate(entity.rotation)
    const bladeCount = radiusToBladeCount(entity.radius)
    for (let index = 0; index < bladeCount; index += 1) {
      const angle = (index / bladeCount) * Math.PI * 2
      ctx.save()
      ctx.rotate(angle)
      const bladeOuterRadius = visualRadius
      const gradient = ctx.createLinearGradient(bodyRadius - 10, 0, bladeOuterRadius + 8, 0)
      gradient.addColorStop(0, '#d7dee7')
      gradient.addColorStop(1, '#7b8794')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(bodyRadius - 6, 0)
      ctx.lineTo(bladeOuterRadius + 4, -5)
      ctx.lineTo(bladeOuterRadius + 10, 0)
      ctx.lineTo(bladeOuterRadius + 4, 5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  if (bubbleSprite.complete && bubbleSprite.naturalWidth > 0) {
    const spriteSize = bodyRadius * 2.42
    ctx.drawImage(
      bubbleSprite,
      -spriteSize / 2,
      -spriteSize / 2,
      spriteSize,
      spriteSize,
    )
  } else {
    const diskGradient = ctx.createRadialGradient(-bodyRadius * 0.3, -bodyRadius * 0.35, 8, 0, 0, bodyRadius)
    diskGradient.addColorStop(0, `hsla(${entity.hue} 85% 72% / 0.92)`)
    diskGradient.addColorStop(0.45, '#d5dbe3')
    diskGradient.addColorStop(1, '#4b5563')
    ctx.fillStyle = diskGradient
    ctx.beginPath()
    ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.lineWidth = size.width > size.height ? 8 : 10
  ctx.strokeStyle = entity.isTouching ? 'rgba(239, 68, 68, 0.95)' : 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2)
  ctx.stroke()

  drawAvatar(ctx, entity, image, bodyRadius)

  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = `600 ${Math.max(11, bodyRadius * 0.16)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(entity.isPrimary ? entity.username : `${entity.username} II`, 0, -bodyRadius * 0.72)

  if (entity.specialMode === 'lion') {
    ctx.save()
    ctx.shadowBlur = 30
    ctx.shadowColor = 'rgba(250, 204, 21, 0.9)'
    ctx.fillStyle = 'rgba(255, 224, 130, 0.98)'
    ctx.font = `900 ${Math.max(26, bodyRadius * 0.36)}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(entity.username, 0, bodyRadius + Math.max(54, bodyRadius * 0.9))
    ctx.restore()
  }

  if (entity.entityType === 'comment') {
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.font = `700 ${Math.max(10, bodyRadius * 0.18)}px sans-serif`
    ctx.textBaseline = 'middle'
    const commentLines = (entity.commentText ?? '')
      .trim()
      .slice(0, 48)
      .match(/.{1,16}(?:\s|$)|\S+/g)
      ?.slice(0, 3)
      .map((line) => line.trim())
      .filter(Boolean) ?? []

    commentLines.forEach((line, index) => {
      const offset = (index - (commentLines.length - 1) / 2) * Math.max(12, bodyRadius * 0.18)
      const textY = bodyRadius * 0.25 + offset
      const textMetrics = ctx.measureText(line)
      const textWidth = textMetrics.width
      const textHeight = Math.max(16, bodyRadius * 0.22)

      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(
        -(textWidth / 2) - 8,
        textY - textHeight * 0.6,
        textWidth + 16,
        textHeight,
      )

      ctx.fillStyle = 'rgba(255,255,255,0.96)'
      ctx.fillText(line, 0, textY)
    })

    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.font = `600 ${Math.max(9, bodyRadius * 0.14)}px sans-serif`
    ctx.fillText(`${Math.max(0, entity.touchesRemaining ?? 0)} toques`, 0, bodyRadius * 0.82)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.font = `700 ${Math.max(12, bodyRadius * 0.24)}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(`${formatHpValue(entity.hp)} HP`, 0, bodyRadius * 0.7)

    ctx.fillStyle = 'rgba(15, 23, 42, 0.68)'
    ctx.fillRect(-bodyRadius * 0.55, bodyRadius * 0.8, bodyRadius * 1.1, Math.max(10, bodyRadius * 0.16))
    ctx.fillStyle = `hsla(${entity.hue} 90% 58% / 0.95)`
    const healthRatio = clamp(entity.hp / Math.max(entity.maxHp, entity.hp, 1), 0.08, 1)
    ctx.fillRect(
      -bodyRadius * 0.55,
      bodyRadius * 0.8,
      bodyRadius * 1.1 * healthRatio,
      Math.max(10, bodyRadius * 0.16),
    )
  }

  ctx.restore()
}

function drawShowcaseConfetti(
  ctx: CanvasRenderingContext2D,
  entities: SawEntity[],
  imageCache: Map<string, HTMLImageElement>,
  size: CanvasSize,
  now: number,
) {
  for (const entity of entities) {
    drawSaw(ctx, entity, imageCache, size, now)
  }
}

function drawNeedleBurstEffects(
  ctx: CanvasRenderingContext2D,
  effects: NeedleBurstEffect[],
  now: number,
) {
  for (const effect of effects) {
    const progress = clamp((now - effect.startedAt) / effect.duration, 0, 1)
    const alpha = 1 - progress
    const burstRadius = effect.radius * (0.8 + progress * 1.15)

    ctx.save()
    ctx.translate(effect.x, effect.y)
    ctx.rotate(progress * Math.PI * 0.18)

    for (let index = 0; index < effect.lineCount; index += 1) {
      const angle = (index / effect.lineCount) * Math.PI * 2
      ctx.save()
      ctx.rotate(angle)
      ctx.strokeStyle = `hsla(${effect.hue} 20% 92% / ${alpha})`
      ctx.lineWidth = Math.max(1.2, 4 * alpha)
      ctx.beginPath()
      ctx.moveTo(effect.radius * 0.3, 0)
      ctx.lineTo(burstRadius, 0)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }
}

function drawScreenOverlayEffects(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  effects: ScreenOverlayEffect[],
  now: number,
) {
  for (const effect of effects) {
    const progress = clamp((now - effect.startedAt) / effect.duration, 0, 1)
    const overlayAlpha = 1 - progress * 0.55
    const hasTarget = typeof effect.targetX === 'number' && typeof effect.targetY === 'number'
    const gloveProgress = hasTarget ? clamp(progress / 0.32, 0, 1) : clamp(progress / 0.45, 0, 1)
    const spriteWidth = hasTarget
      ? size.width * (0.18 + gloveProgress * 0.025)
      : size.width * (0.44 + gloveProgress * 0.06)
    const spriteHeight = spriteWidth * 0.78
    const centerX = hasTarget ? effect.targetX! : size.width * 0.5
    const startY = size.height + spriteHeight * 0.35
    const endY = hasTarget ? effect.targetY! : size.height * 0.34
    const startX = hasTarget ? clamp(effect.targetX! + spriteWidth * 0.9, spriteWidth * 0.5, size.width - spriteWidth * 0.5) : centerX
    const easedProgress = 1 - Math.pow(1 - gloveProgress, 3)
    const currentX = startX + (centerX - startX) * easedProgress
    const centerY = startY + (endY - startY) * easedProgress

    if (gloveProgress < 1 || progress < 0.62) {
      const fadeStart = hasTarget ? 0.28 : 0.45
      const fadeWindow = hasTarget ? 0.14 : 0.17
      const gloveAlpha = overlayAlpha * (1 - clamp((progress - fadeStart) / fadeWindow, 0, 1))

      ctx.save()
      ctx.globalAlpha = gloveAlpha
      ctx.translate(currentX, centerY)
      ctx.rotate((hasTarget ? 0.12 : -0.18 + gloveProgress * 0.22) * Math.PI)

      const glowGradient = ctx.createRadialGradient(0, 0, spriteWidth * 0.06, 0, 0, spriteWidth * 0.52)
      glowGradient.addColorStop(0, 'rgba(255,255,255,0.95)')
      glowGradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(0, 0, spriteWidth * 0.55, 0, Math.PI * 2)
      ctx.fill()

      if (boxingGloveSprite.complete && boxingGloveSprite.naturalWidth > 0) {
        ctx.drawImage(
          boxingGloveSprite,
          -spriteWidth / 2,
          -spriteHeight / 2,
          spriteWidth,
          spriteHeight,
        )
      }

      ctx.restore()
    }

  }
}

function drawDespawnEffects(
  ctx: CanvasRenderingContext2D,
  effects: DespawnEffect[],
  now: number,
) {
  for (const effect of effects) {
    const progress = clamp((now - effect.startedAt) / effect.duration, 0, 1)
    const alpha = 1 - progress
    const radius = effect.radius * (1 + progress * 0.4)

    ctx.save()
    ctx.translate(effect.x, effect.y)
    ctx.strokeStyle = `hsla(${effect.hue} 95% 62% / ${alpha})`
    ctx.lineWidth = 6 * alpha
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function updateLeaderboardSnapshot(
  leaderboardMap: Map<string, LeaderboardEntry>,
  entities: Map<string, SawEntity>,
) {
  for (const [id, entry] of leaderboardMap.entries()) {
    const playerSaws = [...entities.values()].filter((entity) => entity.playerId === id)
    entry.currentHp = playerSaws.reduce((total, entity) => total + entity.hp, 0)
    entry.sawCount = playerSaws.length
    entry.isActive = playerSaws.length > 0
  }

  return [...leaderboardMap.values()].sort((left, right) => {
    if (right.totalDonated !== left.totalDonated) {
      return right.totalDonated - left.totalDonated
    }
    return right.currentHp - left.currentHp
  })
}

function cloneWinnerSummary(summary: RoundWinnerSummary | null) {
  return summary ? { ...summary } : null
}

function getRoundParticipants(entityMap: Map<string, SawEntity>) {
  return [...entityMap.values()].filter((entity) => entity.entityType === 'standard' && entity.hp > 0)
}

function evictFirstCommentEntity(entityMap: Map<string, SawEntity>) {
  for (const [entityId, entity] of entityMap.entries()) {
    if (entity.entityType === 'comment') {
      entityMap.delete(entityId)
      return true
    }
  }

  return false
}

function addEntityRespectingLimit(entityMap: Map<string, SawEntity>, entity: SawEntity) {
  if (entityMap.size >= maxBubbleEntities && !evictFirstCommentEntity(entityMap)) {
    return false
  }

  entityMap.set(entity.id, entity)
  return true
}

function trimEntitiesToLimit(entityMap: Map<string, SawEntity>) {
  while (entityMap.size > maxBubbleEntities) {
    if (!evictFirstCommentEntity(entityMap)) {
      break
    }
  }
}

export function useCircularSawGame(): UseCircularSawGameResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const entitiesRef = useRef(new Map<string, SawEntity>())
  const despawnEffectsRef = useRef<DespawnEffect[]>([])
  const needleBurstEffectsRef = useRef<NeedleBurstEffect[]>([])
  const screenOverlayEffectsRef = useRef<ScreenOverlayEffect[]>([])
  const leaderboardRef = useRef(new Map<string, LeaderboardEntry>())
  const avatarCacheRef = useRef(new Map<string, HTMLImageElement>())
  const lastTimeRef = useRef<number | null>(null)
  const lastPublishRef = useRef(0)
  const dprRef = useRef(1)
  const canvasSizeRef = useRef(defaultCanvasSize)
  const boomAudioRef = useRef<HTMLAudioElement | null>(null)
  const boxingBellAudioRef = useRef<HTMLAudioElement | null>(null)
  const confettiAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioEnabledRef = useRef(false)
  const roundStartedAtRef = useRef<number | null>(null)
  const roundEndsAtRef = useRef<number | null>(null)
  const winnerShowcaseUntilRef = useRef<number | null>(null)
  const winnerEntityIdRef = useRef<string | null>(null)
  const lastWinnerRef = useRef<RoundWinnerSummary | null>(null)
  const showcaseWinnerRef = useRef<RoundWinnerSummary | null>(null)
  const [canvasSize, setCanvasSize] = useState(defaultCanvasSize)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [activeSaws, setActiveSaws] = useState<ActiveSawSummary[]>([])
  const [recentEvents, setRecentEvents] = useState<DonationEvent[]>([])
  const [donationHistory, setDonationHistory] = useState<DonationEvent[]>([])
  const [roundStatus, setRoundStatus] = useState<RoundStatus>({
    isActive: false,
    participantCount: 0,
    remainingMs: roundDurationMs,
    startedAt: null,
    lastWinner: null,
    showcaseWinner: null,
  })
  const [audioEnabled, setAudioEnabled] = useState(false)

  function buildRoundStatusSnapshot(now: number): RoundStatus {
    const roundEndsAt = roundEndsAtRef.current
    return {
      isActive: Boolean(roundStartedAtRef.current && roundEndsAt && roundEndsAt > now),
      participantCount: getRoundParticipants(entitiesRef.current).length,
      remainingMs: roundEndsAt ? Math.max(0, roundEndsAt - now) : roundDurationMs,
      startedAt: roundStartedAtRef.current,
      lastWinner: cloneWinnerSummary(lastWinnerRef.current),
      showcaseWinner:
        winnerShowcaseUntilRef.current && winnerShowcaseUntilRef.current > now
          ? cloneWinnerSummary(showcaseWinnerRef.current)
          : null,
    }
  }

  function buildSharedRoundState(): SharedRoundState {
    return {
      startedAt: roundStartedAtRef.current,
      endsAt: roundEndsAtRef.current,
      winnerShowcaseUntil: winnerShowcaseUntilRef.current,
      winnerEntityId: winnerEntityIdRef.current,
      lastWinner: cloneWinnerSummary(lastWinnerRef.current),
      showcaseWinner: cloneWinnerSummary(showcaseWinnerRef.current),
    }
  }

  function applySharedRoundState(roundState?: SharedRoundState) {
    roundStartedAtRef.current = roundState?.startedAt ?? null
    roundEndsAtRef.current = roundState?.endsAt ?? null
    winnerShowcaseUntilRef.current = roundState?.winnerShowcaseUntil ?? null
    winnerEntityIdRef.current = roundState?.winnerEntityId ?? null
    lastWinnerRef.current = cloneWinnerSummary(roundState?.lastWinner ?? null)
    showcaseWinnerRef.current = cloneWinnerSummary(roundState?.showcaseWinner ?? null)
  }

  function startRound(now: number) {
    roundStartedAtRef.current = now
    roundEndsAtRef.current = now + roundDurationMs
    winnerShowcaseUntilRef.current = null
    winnerEntityIdRef.current = null
    showcaseWinnerRef.current = null
  }

  function resetArenaForNextRound() {
    entitiesRef.current.clear()
    despawnEffectsRef.current = []
    needleBurstEffectsRef.current = []
    screenOverlayEffectsRef.current = []
    leaderboardRef.current.clear()
    roundStartedAtRef.current = null
    roundEndsAtRef.current = null
    winnerShowcaseUntilRef.current = null
    winnerEntityIdRef.current = null
    showcaseWinnerRef.current = null
    lastPublishRef.current = 0
    setLeaderboard([])
    setActiveSaws([])
    setRecentEvents([])
  }

  function beginWinnerShowcase(winner: SawEntity, now: number) {
    const survivedMs = roundStartedAtRef.current ? Math.max(0, now - roundStartedAtRef.current) : roundDurationMs
    const winnerSummary: RoundWinnerSummary = {
      playerId: winner.playerId,
      username: winner.username,
      avatarUrl: winner.avatarUrl,
      hp: winner.hp,
      survivedMs,
      wonAt: now,
    }

    winner.specialMode = undefined
    winner.specialPhase = undefined
    winner.specialPhaseStartedAt = undefined
    winner.specialModeUntil = undefined
    winner.invulnerableUntil = undefined
    winner.isPrimary = true
    winner.x = canvasSizeRef.current.width * 0.5
    winner.y = canvasSizeRef.current.height * 0.54
    winner.vx = 0
    winner.vy = 0
    winner.radius = Math.min(
      Math.max(hpToRadius(winner.hp) * 1.85, 120),
      Math.min(canvasSizeRef.current.width, canvasSizeRef.current.height) * 0.28,
    )

    entitiesRef.current = new Map([[winner.id, winner]])
    leaderboardRef.current = new Map([
      [winner.playerId, {
        id: winner.playerId,
        username: winner.username,
        avatarUrl: winner.avatarUrl,
        totalDonated: leaderboardRef.current.get(winner.playerId)?.totalDonated ?? winner.hp,
        currentHp: winner.hp,
        sawCount: 1,
        isActive: true,
      }],
    ])

    roundStartedAtRef.current = null
    roundEndsAtRef.current = null
    winnerEntityIdRef.current = winner.id
    winnerShowcaseUntilRef.current = now + winnerShowcaseDurationMs
    showcaseWinnerRef.current = winnerSummary
    lastWinnerRef.current = winnerSummary
  }

  function finalizeRound(now: number) {
    const participants = getRoundParticipants(entitiesRef.current)
    if (participants.length === 0) {
      roundStartedAtRef.current = null
      roundEndsAtRef.current = null
      showcaseWinnerRef.current = null
      winnerShowcaseUntilRef.current = null
      winnerEntityIdRef.current = null
      return
    }

    participants.sort((left, right) => {
      if (right.hp !== left.hp) {
        return right.hp - left.hp
      }

      return right.maxHp - left.maxHp
    })

    beginWinnerShowcase(participants[0], now)
  }

  async function enableAudio() {
    try {
      audioEnabledRef.current = true
      setAudioEnabled(true)
      return true
    } catch {
      audioEnabledRef.current = false
      setAudioEnabled(false)
      return false
    }
  }

  async function toggleAudio() {
    if (audioEnabledRef.current) {
      audioEnabledRef.current = false
      setAudioEnabled(false)
      return false
    }

    return enableAudio()
  }

  function publishSnapshots(snapshotNow = Date.now()) {
    const leaderboardSnapshot = updateLeaderboardSnapshot(
      leaderboardRef.current,
      entitiesRef.current,
    )

    setLeaderboard(leaderboardSnapshot)
    setActiveSaws(
      [...entitiesRef.current.values()]
        .sort((left, right) => right.hp - left.hp)
        .map((entity) => ({
          id: entity.id,
          playerId: entity.playerId,
          username: entity.username,
          avatarUrl: entity.avatarUrl,
            entityType: entity.entityType,
            commentText: entity.commentText,
            touchesRemaining: entity.touchesRemaining,
          hp: entity.hp,
          maxHp: entity.maxHp,
          radius: Math.round(entity.radius),
          isPrimary: entity.isPrimary,
        })),
    )
    setRoundStatus(buildRoundStatusSnapshot(snapshotNow))
  }

  function resetGame() {
    entitiesRef.current.clear()
    despawnEffectsRef.current = []
    needleBurstEffectsRef.current = []
    screenOverlayEffectsRef.current = []
    leaderboardRef.current.clear()
    lastPublishRef.current = 0
    lastTimeRef.current = null
    roundStartedAtRef.current = null
    roundEndsAtRef.current = null
    winnerShowcaseUntilRef.current = null
    winnerEntityIdRef.current = null
    lastWinnerRef.current = null
    showcaseWinnerRef.current = null
    setLeaderboard([])
    setActiveSaws([])
    setRecentEvents([])
    setDonationHistory([])
    setRoundStatus({
      isActive: false,
      participantCount: 0,
      remainingMs: roundDurationMs,
      startedAt: null,
      lastWinner: null,
      showcaseWinner: null,
    })
  }

  function getSharedGameState(): SharedGameState {
    return {
      entities: [...entitiesRef.current.values()].map((entity) => ({ ...entity })),
      leaderboard: [...leaderboardRef.current.values()].map((entry) => ({ ...entry })),
      recentEvents: recentEvents.map((event) => ({ ...event })),
      donationHistory: donationHistory.map((event) => ({ ...event })),
      roundState: buildSharedRoundState(),
    }
  }

  function applySharedGameState(state: SharedGameState) {
    const nextEntities = new Map(state.entities.map((entity) => {
      const normalizedEntity = normalizeImportedEntity(entity)
      return [normalizedEntity.id, normalizedEntity]
    }))
    const nextLeaderboard = new Map(state.leaderboard.map((entry) => [entry.id, { ...entry }]))

    trimEntitiesToLimit(nextEntities)

    for (const entry of nextLeaderboard.values()) {
      if (!entry.isActive || entry.currentHp <= 0) {
        continue
      }

      const hasVisibleEntity = [...nextEntities.values()].some(
        (entity) => entity.playerId === entry.id && entity.hp > 0,
      )

      if (hasVisibleEntity) {
        continue
      }

      const fallbackEntity = createNewSaw(
        entry.id,
        entry.username,
        entry.avatarUrl,
        Math.max(0.25, entry.currentHp),
        canvasSizeRef.current,
        true,
        Math.random() * 360,
      )
      addEntityRespectingLimit(nextEntities, fallbackEntity)
    }

    entitiesRef.current = nextEntities
    leaderboardRef.current = nextLeaderboard
  applySharedRoundState(state.roundState)
    setRecentEvents(state.recentEvents.map((event) => ({ ...event })))
    setDonationHistory(state.donationHistory.map((event) => ({ ...event })))
    publishSnapshots()
  }

  function findPlayerSaws(playerId: string) {
    return [...entitiesRef.current.values()].filter((entity) => entity.playerId === playerId)
  }

  function findPrimarySaw(playerId: string) {
    const playerSaws = findPlayerSaws(playerId)
    return playerSaws.find((entity) => entity.isPrimary) ?? playerSaws[0]
  }

  function promotePrimaryIfNeeded(playerId: string) {
    const playerSaws = findPlayerSaws(playerId)
    if (playerSaws.length === 0 || playerSaws.some((entity) => entity.isPrimary)) {
      return
    }

    playerSaws.sort((left, right) => right.hp - left.hp)[0].isPrimary = true
  }

  function splitPrimarySaw(primary: SawEntity) {
    if (primary.hp <= 1 || primary.specialMode === 'lion') {
      return false
    }

    const leftHp = Math.ceil(primary.hp / 2)
    const rightHp = Math.floor(primary.hp / 2)
    if (rightHp <= 0) {
      return false
    }

    const clone = createNewSaw(
      primary.playerId,
      primary.username,
      primary.avatarUrl,
      rightHp,
      canvasSizeRef.current,
      false,
      primary.hue + 28,
    )

    const nextPrimaryRadius = hpToRadius(leftHp)
    clone.x = clamp(primary.x + nextPrimaryRadius * 0.55, clone.radius, canvasSizeRef.current.width - clone.radius)
    clone.y = clamp(primary.y + nextPrimaryRadius * 0.35, clone.radius, canvasSizeRef.current.height - clone.radius)
    clone.vx = primary.vx + splitImpulse
    clone.vy = primary.vy - splitImpulse * 0.35

    if (!addEntityRespectingLimit(entitiesRef.current, clone)) {
      return false
    }

    primary.hp = leftHp
    primary.maxHp = Math.max(primary.maxHp, leftHp)
    primary.radius = nextPrimaryRadius
    primary.vx -= splitImpulse * 0.6
    primary.vy += splitImpulse * 0.25
    return true
  }

  function applyConfettiMode(entity: SawEntity, now: number) {
    entity.specialMode = 'confetti'
    entity.specialPhase = 'showcase'
    entity.specialPhaseStartedAt = now
    const spinDuration = getConfettiSpinDuration(entity)
    entity.specialModeUntil = now + confettiShowcaseDuration + spinDuration
    entity.invulnerableUntil = entity.specialModeUntil
    entity.x = canvasSizeRef.current.width * 0.5
    entity.y = canvasSizeRef.current.height * 0.5
    entity.vx = 0
    entity.vy = 0
  }

  function finishConfettiMode(entity: SawEntity) {
    entity.x = canvasSizeRef.current.width * 0.5
    entity.y = canvasSizeRef.current.height * 0.46
    finishSpecialMode(entity)
  }

  function applyBoxingMode(entity: SawEntity, now: number) {
    entity.specialMode = 'boxing'
    entity.specialModeUntil = now + boxingEntryDuration
    entity.invulnerableUntil = now + boxingEntryDuration
    entity.x = canvasSizeRef.current.width * 0.5
    entity.y = canvasSizeRef.current.height * 0.32
    entity.vx = 0
    entity.vy = 0
  }

  function applyLionBossMode(entity: SawEntity) {
    entity.specialMode = 'lion'
    entity.specialPhase = undefined
    entity.specialPhaseStartedAt = undefined
    entity.specialModeUntil = undefined
    entity.invulnerableUntil = undefined
    entity.hp = lionBossHp
    entity.maxHp = lionBossHp
    entity.radius = lionBossRadius
    entity.x = canvasSizeRef.current.width * 0.5
    entity.y = canvasSizeRef.current.height * 0.54
    entity.vx = 0
    entity.vy = 0
  }

  function removeExistingLionBoss(nextPlayerId: string) {
    for (const [entityId, entity] of entitiesRef.current.entries()) {
      if (entity.specialMode === 'lion' && entity.playerId !== nextPlayerId) {
        entitiesRef.current.delete(entityId)
      }
    }
  }

  function applyBoxingStrike(playerId: string, donorName: string, quantity: number, now: number) {
    const totalDamage = boxingStrikeDamage * Math.max(1, quantity)
    for (const entity of entitiesRef.current.values()) {
      if (entity.playerId === playerId || entity.entityType !== 'standard') {
        continue
      }

      entity.hp -= totalDamage
      entity.lastDamageAt = now
      despawnEffectsRef.current.push({
        id: `boxing-impact-${entity.id}-${now}`,
        x: entity.x,
        y: entity.y,
        radius: Math.max(entity.radius * 1.15, 52),
        hue: 0,
        startedAt: now,
        duration: 320,
      })

      screenOverlayEffectsRef.current.push({
        id: `boxing-hit-${entity.id}-${now}`,
        type: 'boxing-glove',
        donorName: '',
        targetX: entity.x,
        targetY: entity.y,
        showDonorName: false,
        startedAt: now,
        duration: 560,
      })
    }

    screenOverlayEffectsRef.current.push({
      id: `boxing-name-${playerId}-${now}`,
      type: 'boxing-glove',
      donorName,
      showDonorName: false,
      startedAt: now,
      duration: 2000,
    })
  }

  function donate(event: DonationEvent): GiftApplicationResult {
    const normalizedUsername = event.username.trim()
    if (!normalizedUsername) {
      return { applied: false, reason: 'Usuario invalido' }
    }

    const specialNow = performance.now()

    const playerId = buildId(normalizedUsername)
    let primary = findPrimarySaw(playerId)

    if (event.action === 'split') {
      if (!primary) {
        return { applied: false, reason: 'No hay sierra principal para dividir' }
      }

      const didSplit = splitPrimarySaw(primary)
      if (!didSplit) {
        return { applied: false, reason: 'HP insuficiente para dividir' }
      }
    } else if (event.action === 'comment') {
      const commentEntity = createNewSaw(
        `${playerId}-comment-${Date.now()}`,
        normalizedUsername,
        event.avatarUrl,
        Math.max(2.25, event.hpDelta),
        canvasSizeRef.current,
        false,
        Math.random() * 360,
        {
          entityType: 'comment',
          commentText: event.commentText,
          touchesRemaining: 3,
        },
      )
      if (!addEntityRespectingLimit(entitiesRef.current, commentEntity)) {
        return { applied: false, reason: 'Limite de burbujas alcanzado' }
      }
    } else {
      if (!primary) {
        const newPrimary = createNewSaw(
          playerId,
          normalizedUsername,
          event.avatarUrl,
          Math.max(0.25, event.hpDelta),
          canvasSizeRef.current,
          true,
          Math.random() * 360,
        )
        if (!addEntityRespectingLimit(entitiesRef.current, newPrimary)) {
          return { applied: false, reason: 'Limite de burbujas alcanzado' }
        }
        primary = newPrimary
      } else {
        primary.username = normalizedUsername
        primary.avatarUrl = event.avatarUrl.trim() || primary.avatarUrl
        if (primary.specialMode !== 'lion') {
          primary.hp += event.hpDelta
          primary.maxHp = Math.max(primary.maxHp, primary.hp)
          primary.radius = hpToRadius(primary.hp)
        }
        primary.vx += (Math.random() - 0.5) * 120
        primary.vy += (Math.random() - 0.5) * 120
      }

      if (primary) {
        if (event.action === 'confetti' && primary.specialMode !== 'lion') {
          applyConfettiMode(primary, specialNow)
          playTransientAudio(audioEnabledRef.current, confettiAudioRef.current)
        }

        if (event.action === 'boxing' && primary.specialMode !== 'lion') {
          applyBoxingMode(primary, specialNow)
          applyBoxingStrike(playerId, normalizedUsername, event.quantity, specialNow)
          playTransientAudio(audioEnabledRef.current, boxingBellAudioRef.current)
        }

        if (event.action === 'lion') {
          removeExistingLionBoss(playerId)
          applyLionBossMode(primary)
        }
      }
    }

    const currentLeaderboard = leaderboardRef.current.get(playerId)
    if (currentLeaderboard) {
      currentLeaderboard.username = normalizedUsername
      currentLeaderboard.avatarUrl = event.avatarUrl.trim() || currentLeaderboard.avatarUrl
      currentLeaderboard.totalDonated += Math.max(0, event.hpDelta)
    } else {
      leaderboardRef.current.set(playerId, {
        id: playerId,
        username: normalizedUsername,
        avatarUrl: event.avatarUrl.trim(),
        totalDonated: Math.max(0, event.hpDelta),
        currentHp: Math.max(0, event.hpDelta),
        sawCount: 0,
        isActive: true,
      })
    }

    setRecentEvents((current) => [event, ...current].slice(0, maxRecentEvents))
    setDonationHistory((current) => [event, ...current])
    publishSnapshots()
    return { applied: true }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const boomAudio = new Audio('/sound/burbujas_boom.m4a')
    boomAudio.volume = 0.75
    boomAudio.preload = 'auto'
    boomAudioRef.current = boomAudio

    const boxingBellAudio = new Audio('/sound/box_campana.mp3')
    boxingBellAudio.volume = 0.82
    boxingBellAudio.preload = 'auto'
    boxingBellAudioRef.current = boxingBellAudio

    const confettiAudio = new Audio('/sound/confeti.mp3')
    confettiAudio.volume = 0.85
    confettiAudio.preload = 'auto'
    confettiAudioRef.current = confettiAudio

    const removeUnlockListeners = () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }

    const unlockAudio = async () => {
      const didEnable = await enableAudio()
      if (didEnable) {
        removeUnlockListeners()
      }
    }

    window.addEventListener('pointerdown', unlockAudio)
    window.addEventListener('keydown', unlockAudio)
    window.addEventListener('touchstart', unlockAudio)

    const playBoomSound = () => {
      if (!audioEnabledRef.current) {
        return
      }

      const baseAudio = boomAudioRef.current
      if (!baseAudio) {
        return
      }

      const boomInstance = baseAudio.cloneNode() as HTMLAudioElement
      boomInstance.volume = baseAudio.volume
      const playPromise = boomInstance.play()
      if (playPromise) {
        playPromise.catch(() => {})
      }
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const measuredWidth = Math.floor(bounds.width || defaultCanvasSize.width)
      const measuredHeight = Math.floor(bounds.height || defaultCanvasSize.height)
      const isLandscapeCanvas = measuredWidth > measuredHeight
      const width = Math.max(isLandscapeCanvas ? 320 : 420, measuredWidth)
      const height = Math.max(isLandscapeCanvas ? 220 : 420, measuredHeight)
      const devicePixelRatio = window.devicePixelRatio || 1

      dprRef.current = devicePixelRatio
      canvas.width = Math.floor(width * devicePixelRatio)
      canvas.height = Math.floor(height * devicePixelRatio)
      canvasSizeRef.current = { width, height }
      setCanvasSize({ width, height })

      for (const entity of entitiesRef.current.values()) {
        entity.radius = clamp(entity.radius, minSawRadius, entity.radius)
        containInsideCanvas(entity, canvasSizeRef.current)
      }
    }

    resize()
    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(canvas)

    const tick = (time: number) => {
      const wallNow = Date.now()
      const dt = Math.min(0.033, ((time - (lastTimeRef.current ?? time)) || 16.7) / 1000)
      lastTimeRef.current = time

      for (const entity of entitiesRef.current.values()) {
        entity.isTouching = false

        const isWinnerShowcaseEntity = winnerEntityIdRef.current === entity.id
          && Boolean(winnerShowcaseUntilRef.current && winnerShowcaseUntilRef.current > wallNow)

        if (isWinnerShowcaseEntity) {
          entity.x = canvasSizeRef.current.width * 0.5
          entity.y = canvasSizeRef.current.height * 0.54
          entity.vx = 0
          entity.vy = 0
          entity.rotation += dt * 0.45
          containInsideCanvas(entity, canvasSizeRef.current)
          continue
        }

        if (entity.specialMode === 'confetti' && entity.specialPhase === 'showcase') {
          const showcaseFinished = time - (entity.specialPhaseStartedAt ?? time) >= confettiShowcaseDuration
          if (showcaseFinished) {
            entity.specialPhase = 'plunge'
            entity.specialPhaseStartedAt = time
            entity.x = canvasSizeRef.current.width * 0.5
            entity.y = canvasSizeRef.current.height * 0.5
          }
        }

        const expiredConfetti = entity.specialMode === 'confetti' && !isSpecialActive(entity, time)
        const expiredOtherSpecial = entity.specialMode === 'boxing' && !isSpecialActive(entity, time)

        if (expiredConfetti) {
          finishConfettiMode(entity)
        } else if (expiredOtherSpecial) {
          finishSpecialMode(entity)
        }

        if (!updateSpecialMotion(entity, dt, time, canvasSizeRef.current)) {
          updateMotion(entity, dt, time)
        }

        containInsideCanvas(entity, canvasSizeRef.current)
      }

      const saws = [...entitiesRef.current.values()]
      for (let first = 0; first < saws.length; first += 1) {
        for (let second = first + 1; second < saws.length; second += 1) {
          const damage = resolveCollision(saws[first], saws[second])
          if (!damage) {
            continue
          }

          const firstIsComment = saws[first].entityType === 'comment'
          const secondIsComment = saws[second].entityType === 'comment'
          const firstInvulnerable = isInvulnerable(saws[first], time)
          const secondInvulnerable = isInvulnerable(saws[second], time)

          saws[first].isTouching = true
          saws[second].isTouching = true

          if (firstIsComment) {
            saws[first].touchesRemaining = Math.max(0, (saws[first].touchesRemaining ?? 0) - 1)
            saws[first].lastDamageAt = time
          }

          if (secondIsComment) {
            saws[second].touchesRemaining = Math.max(0, (saws[second].touchesRemaining ?? 0) - 1)
            saws[second].lastDamageAt = time
          }

          if (!firstIsComment && !secondIsComment) {
            if (!firstInvulnerable) {
              saws[first].hp -= damage
            }
            if (!secondInvulnerable) {
              saws[second].hp -= damage
            }
            saws[first].lastDamageAt = time
            saws[second].lastDamageAt = time
          }
        }
      }

      for (const entity of saws) {
        if (entity.entityType === 'comment') {
          if ((entity.touchesRemaining ?? 0) > 0) {
            continue
          }

          entitiesRef.current.delete(entity.id)
          despawnEffectsRef.current.push({
            id: `${entity.id}-${time}`,
            x: entity.x,
            y: entity.y,
            radius: entity.radius,
            hue: entity.hue,
            startedAt: time,
            duration: 280,
          })
          playBoomSound()
          continue
        }

        if (entity.hp > 0) {
          entity.maxHp = Math.max(entity.maxHp, entity.hp)
          if (entity.specialMode !== 'lion') {
            entity.radius = hpToRadius(entity.hp)
          } else {
            entity.radius = lionBossRadius
          }
          continue
        }

        entitiesRef.current.delete(entity.id)
        promotePrimaryIfNeeded(entity.playerId)
        despawnEffectsRef.current.push({
          id: `${entity.id}-${time}`,
          x: entity.x,
          y: entity.y,
          radius: entity.radius,
          hue: entity.hue,
          startedAt: time,
          duration: 280,
        })
        playBoomSound()
      }

      if (winnerShowcaseUntilRef.current && winnerShowcaseUntilRef.current <= wallNow) {
        resetArenaForNextRound()
      } else if (roundEndsAtRef.current && wallNow >= roundEndsAtRef.current) {
        finalizeRound(wallNow)
      } else if (!roundStartedAtRef.current && !winnerShowcaseUntilRef.current && getRoundParticipants(entitiesRef.current).length > 2) {
        startRound(wallNow)
      }

      despawnEffectsRef.current = despawnEffectsRef.current.filter(
        (effect) => time - effect.startedAt < effect.duration,
      )
      needleBurstEffectsRef.current = needleBurstEffectsRef.current.filter(
        (effect) => time - effect.startedAt < effect.duration,
      )
      screenOverlayEffectsRef.current = screenOverlayEffectsRef.current.filter(
        (effect) => time - effect.startedAt < effect.duration,
      )

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      drawBackground(context, canvasSizeRef.current)

      const showcaseConfettiEntities: SawEntity[] = []
      for (const entity of entitiesRef.current.values()) {
        if (entity.specialMode === 'confetti' && entity.specialPhase === 'showcase' && isSpecialActive(entity, time)) {
          showcaseConfettiEntities.push(entity)
          continue
        }

        drawSaw(context, entity, avatarCacheRef.current, canvasSizeRef.current, time)
      }
      drawShowcaseConfetti(context, showcaseConfettiEntities, avatarCacheRef.current, canvasSizeRef.current, time)
      drawNeedleBurstEffects(context, needleBurstEffectsRef.current, time)
      drawDespawnEffects(context, despawnEffectsRef.current, time)
      drawScreenOverlayEffects(context, canvasSizeRef.current, screenOverlayEffectsRef.current, time)

      if (time - lastPublishRef.current > 120) {
        publishSnapshots(wallNow)
        lastPublishRef.current = time
      }

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      removeUnlockListeners()
      audioEnabledRef.current = false
      setAudioEnabled(false)
      boomAudioRef.current = null
      boxingBellAudioRef.current = null
      confettiAudioRef.current = null
      resizeObserver.disconnect()
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return {
    canvasRef,
    canvasSize,
    leaderboard,
    activeSaws,
    recentEvents,
    donationHistory,
    roundStatus,
    audioEnabled,
    enableAudio,
    toggleAudio,
    resetGame,
    donate,
    getSharedGameState,
    applySharedGameState,
  }
}
