import type { CanvasSize, GiftConfig } from '../types/game'

export const defaultGiftConfigs: GiftConfig[] = [
  {
    id: 'korean-heart',
    giftName: 'Corazon coreano',
    imageUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp',
    hpReward: 55,
    action: 'boost',
    enabled: true,
  },
  {
    id: 'rose',
    giftName: 'Rosa 2',
    imageUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp',
    hpReward: 10,
    action: 'boost',
    enabled: true,
  },
  {
    id: 'second-rose',
    giftName: 'Rosa',
    imageUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp',
    hpReward: 110,
    action: 'boost',
    enabled: true,
  },
  {
    id: 'perfume',
    giftName: 'Perfume',
    imageUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp',
    hpReward: 220,
    action: 'boost',
    enabled: true,
  },
  {
    id: 'confetti',
    giftName: 'Confeti',
    imageUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cb4e11b3834e149f08e1cdcc93870b26~tplv-obj.webp',
    hpReward: 1000,
    action: 'confetti',
    enabled: true,
  },
  {
    id: 'boxing-glove',
    giftName: 'Guante de boxeo',
    imageUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9f8bd92363c400c284179f6719b6ba9c~tplv-obj.webp',
    hpReward: 3000,
    action: 'boxing',
    enabled: true,
  },
]

export const defaultCanvasSize: CanvasSize = {
  width: 720,
  height: 1280,
}

export const minSawDiameter = 96
export const maxSawDiameter = 380
export const minSawRadius = minSawDiameter / 2
export const maxSawRadius = maxSawDiameter / 2
export const bladeLength = 22
export const bladeBase = 10
export const bladeSpacing = 24
export const minBladeCount = 14
export const maxBladeCount = 180
export const maxHpForVisualScale = 24000
export const driftAcceleration = 62
export const drag = 0.998
export const restitution = 0.94
export const maxVelocity = 760
export const minImpactDamage = 8
export const maxImpactDamage = 75
export const impactDamageFactor = 0.12
export const splitImpulse = 280
