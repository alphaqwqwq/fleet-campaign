import { SaveError, type CampaignSave } from './types'
import { decodeCampaignSave } from './validate'

/** Explicit migration boundary. v1 has no predecessor and future versions are rejected. */
export function migrateSave(fromVersion: number, raw: unknown): CampaignSave {
  if (fromVersion !== 1) {
    throw new SaveError('save_unsupported_version', `Cannot migrate campaign schema version ${fromVersion}`)
  }
  return decodeCampaignSave(raw)
}
