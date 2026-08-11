import { isValidCampaignId } from '@fleet-campaign/protocol'
import type { GameView } from '@fleet-campaign/protocol'

import {
  CAMPAIGN_SCHEMA_VERSION,
  SAVE_FORMAT,
  SAVE_FORMAT_VERSION,
  SaveError,
  type CampaignSave,
} from './types'

type UnknownRecord = Record<string, unknown>

const SAVE_KEYS = [
  'schemaVersion',
  'campaignId',
  'contentId',
  'savedAt',
  'gameSnapshot',
  'rngState',
  'migrationMetadata',
] as const
const GAME_KEYS = [
  'contentId',
  'phase',
  'round',
  'activeSeat',
  'actionPoints',
  'units',
  'winnerSeat',
] as const
const PHASES = ['awaiting-player', 'active', 'completed', 'closed'] as const
const SEATS = ['host', 'guest'] as const
const RNG_SEED_PATTERN = /^[A-Za-z0-9_-]{21}[AQgw]$/
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(record: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(record)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isSeat(value: unknown): value is 'host' | 'guest' {
  return typeof value === 'string' && SEATS.includes(value as 'host' | 'guest')
}

function validateGameView(value: unknown): value is GameView {
  if (!isRecord(value) || !hasExactKeys(value, GAME_KEYS)) return false
  if (value.contentId !== 'demo-v1') return false
  if (!PHASES.includes(value.phase as (typeof PHASES)[number])) return false
  if (!isNonNegativeInteger(value.round) || !isNonNegativeInteger(value.actionPoints)) return false
  if (value.activeSeat !== null && !isSeat(value.activeSeat)) return false
  if (value.winnerSeat !== null && !isSeat(value.winnerSeat)) return false
  if (!Array.isArray(value.units) || value.units.length !== 2) return false

  const unitIds = new Set<string>()
  for (const unit of value.units) {
    if (!isRecord(unit) || !hasExactKeys(unit, ['id', 'integrity'])) return false
    if (unit.id !== 'host-unit' && unit.id !== 'guest-unit') return false
    if (!Number.isInteger(unit.integrity) || (unit.integrity as number) < 0 || (unit.integrity as number) > 3) {
      return false
    }
    unitIds.add(unit.id)
  }
  if (unitIds.size !== 2) return false

  const phase = value.phase as (typeof PHASES)[number]
  const hostIntegrity = value.units.find((unit) => isRecord(unit) && unit.id === 'host-unit')?.integrity
  const guestIntegrity = value.units.find((unit) => isRecord(unit) && unit.id === 'guest-unit')?.integrity
  if (typeof hostIntegrity !== 'number' || typeof guestIntegrity !== 'number') return false

  if (phase === 'awaiting-player') {
    if (value.round !== 0 || hostIntegrity !== 3 || guestIntegrity !== 3) return false
  }
  if (phase === 'active') {
    if (
      value.round < 1 ||
      hostIntegrity === 0 ||
      guestIntegrity === 0 ||
      !isSeat(value.activeSeat) ||
      value.actionPoints !== 1 ||
      value.winnerSeat !== null
    ) return false
  } else if (value.activeSeat !== null || value.actionPoints !== 0) {
    return false
  }

  if (phase === 'completed') {
    if (value.round < 1 || !isSeat(value.winnerSeat)) return false
    const defeatedId = value.winnerSeat === 'host' ? 'guest-unit' : 'host-unit'
    const winnerIntegrity = value.winnerSeat === 'host' ? hostIntegrity : guestIntegrity
    const defeated = value.units.find((unit) => isRecord(unit) && unit.id === defeatedId)
    if (!defeated || defeated.integrity !== 0 || winnerIntegrity === 0) return false
  } else if (value.winnerSeat !== null) {
    return false
  }

  return true
}

function assertSupportedSaveVersion(value: UnknownRecord): void {
  if (!Number.isInteger(value.schemaVersion) || (value.schemaVersion as number) < 0) {
    throw new SaveError('save_invalid', 'Campaign save schema version must be a non-negative integer')
  }
  if (value.schemaVersion !== CAMPAIGN_SCHEMA_VERSION) {
    throw new SaveError('save_unsupported_version', 'Campaign save schema version is unsupported')
  }
}

export function decodeCampaignSave(value: unknown): CampaignSave {
  if (!isRecord(value)) throw new SaveError('save_invalid', 'Campaign save must be an object')
  if (!hasExactKeys(value, SAVE_KEYS)) throw new SaveError('save_invalid', 'Campaign save fields are invalid')
  assertSupportedSaveVersion(value)
  if (!isValidCampaignId(value.campaignId)) throw new SaveError('save_invalid', 'campaignId is invalid')
  if (value.contentId !== 'demo-v1') {
    throw new SaveError('save_incompatible_content', 'Campaign content is incompatible')
  }
  if (
    typeof value.savedAt !== 'string' ||
    !ISO_TIMESTAMP_PATTERN.test(value.savedAt) ||
    !Number.isFinite(Date.parse(value.savedAt)) ||
    new Date(value.savedAt).toISOString() !== value.savedAt
  ) {
    throw new SaveError('save_invalid', 'savedAt is invalid')
  }
  if (isRecord(value.gameSnapshot) && value.gameSnapshot.contentId !== 'demo-v1') {
    throw new SaveError('save_incompatible_content', 'Campaign snapshot content is incompatible')
  }
  if (!validateGameView(value.gameSnapshot) || value.gameSnapshot.contentId !== value.contentId) {
    throw new SaveError('save_invalid', 'gameSnapshot violates demo-v1 invariants')
  }
  if (
    !isRecord(value.rngState) ||
    !hasExactKeys(value.rngState, ['seed', 'index']) ||
    typeof value.rngState.seed !== 'string' ||
    !RNG_SEED_PATTERN.test(value.rngState.seed) ||
    value.rngState.index !== 0
  ) {
    throw new SaveError('save_invalid', 'rngState is invalid')
  }
  if (
    !isRecord(value.migrationMetadata) ||
    !hasExactKeys(value.migrationMetadata, ['migratedFrom']) ||
    value.migrationMetadata.migratedFrom !== null
  ) {
    throw new SaveError('save_invalid', 'migrationMetadata is invalid')
  }

  return structuredClone(value) as unknown as CampaignSave
}

export function decodeFleetCampaignSave(value: unknown): {
  format: typeof SAVE_FORMAT
  formatVersion: typeof SAVE_FORMAT_VERSION
  save: unknown
} {
  if (!isRecord(value) || !hasExactKeys(value, ['format', 'formatVersion', 'save'])) {
    throw new SaveError('save_invalid', 'Export package fields are invalid')
  }
  if (value.format !== SAVE_FORMAT) throw new SaveError('save_invalid', 'Export package format is invalid')
  if (value.formatVersion !== SAVE_FORMAT_VERSION) {
    throw new SaveError('save_unsupported_version', 'Export package version is unsupported')
  }
  return { format: SAVE_FORMAT, formatVersion: SAVE_FORMAT_VERSION, save: value.save }
}
