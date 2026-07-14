import {
  bladeSpacing,
  drag,
  driftAcceleration,
  impactDamageFactor,
  maxBladeCount,
  maxHpForVisualScale,
  maxImpactDamage,
  maxSawRadius,
  maxVelocity,
  minBladeCount,
  minImpactDamage,
  minSawRadius,
  restitution,
} from './constants'
import type { CanvasSize, SawEntity } from '../types/game'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function hpToRadius(hp: number) {
  const normalized = clamp(
    Math.log10(Math.max(1, hp) + 1) / Math.log10(maxHpForVisualScale + 1),
    0,
    1,
  )

  return minSawRadius + normalized * (maxSawRadius - minSawRadius)
}

export function radiusToBladeCount(radius: number) {
  const circumference = 2 * Math.PI * radius

  // Las cuchillas mantienen el mismo tamano; lo que crece es cuantas caben en el perimetro.
  return clamp(Math.round(circumference / bladeSpacing), minBladeCount, maxBladeCount)
}

export function createSpawnPosition(size: CanvasSize, radius: number) {
  const x = radius + Math.random() * Math.max(1, size.width - radius * 2)
  const y = radius + Math.random() * Math.max(1, size.height - radius * 2)

  return { x, y }
}

export function limitVelocity(entity: SawEntity) {
  const speed = Math.hypot(entity.vx, entity.vy)
  if (speed <= maxVelocity) {
    return
  }

  const scale = maxVelocity / speed
  entity.vx *= scale
  entity.vy *= scale
}

export function updateMotion(entity: SawEntity, dt: number, time: number) {
  const phase = entity.hue * 0.05
  entity.vx += Math.cos(time * 0.0007 + phase) * dt * 60 * 0.35
  entity.vy += Math.sin(time * 0.0009 + phase * 1.7) * dt * 60 * 0.35
  entity.vx += Math.sin(time * 0.0013 + entity.x * 0.01) * dt * driftAcceleration
  entity.vy += Math.cos(time * 0.0011 + entity.y * 0.01) * dt * driftAcceleration
  entity.vx *= drag
  entity.vy *= drag
  limitVelocity(entity)
  entity.x += entity.vx * dt
  entity.y += entity.vy * dt
  entity.rotation += dt * 1.8
  entity.radius = hpToRadius(entity.hp)
}

export function containInsideCanvas(entity: SawEntity, size: CanvasSize) {
  if (entity.x - entity.radius < 0) {
    entity.x = entity.radius
    entity.vx = Math.abs(entity.vx) * restitution
  }
  if (entity.x + entity.radius > size.width) {
    entity.x = size.width - entity.radius
    entity.vx = -Math.abs(entity.vx) * restitution
  }
  if (entity.y - entity.radius < 0) {
    entity.y = entity.radius
    entity.vy = Math.abs(entity.vy) * restitution
  }
  if (entity.y + entity.radius > size.height) {
    entity.y = size.height - entity.radius
    entity.vy = -Math.abs(entity.vy) * restitution
  }
}

export function resolveCollision(a: SawEntity, b: SawEntity) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const distance = Math.hypot(dx, dy) || 0.0001
  const minDistance = a.radius + b.radius

  if (distance >= minDistance) {
    return null
  }

  const nx = dx / distance
  const ny = dy / distance
  const overlap = minDistance - distance

  a.x -= nx * overlap * 0.5
  a.y -= ny * overlap * 0.5
  b.x += nx * overlap * 0.5
  b.y += ny * overlap * 0.5

  const relativeVelocityX = b.vx - a.vx
  const relativeVelocityY = b.vy - a.vy
  const separatingSpeed = relativeVelocityX * nx + relativeVelocityY * ny

  if (separatingSpeed > 0) {
    return null
  }

  const massA = Math.max(1, a.radius * a.radius)
  const massB = Math.max(1, b.radius * b.radius)

  // Impulso clasico sobre la normal para separarlas y conservar un rebote creible.
  const impulse = ((-(1 + restitution) * separatingSpeed) / (1 / massA + 1 / massB)) * 1.18
  const impulseX = impulse * nx
  const impulseY = impulse * ny

  a.vx -= impulseX / massA
  a.vy -= impulseY / massA
  b.vx += impulseX / massB
  b.vy += impulseY / massB

  const damage = clamp(
    minImpactDamage + Math.abs(separatingSpeed) * impactDamageFactor,
    minImpactDamage,
    maxImpactDamage,
  )

  return damage
}