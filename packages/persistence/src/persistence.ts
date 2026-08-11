import {
  MAX_IMPORT_BYTES,
  SAVE_FORMAT,
  SAVE_FORMAT_VERSION,
  SaveError,
  type CampaignPersistence,
  type CampaignPersistenceOptions,
  type CampaignSave,
  type CampaignSaveStore,
  type FleetCampaignSave,
} from './types'
import { decodeCampaignSave, decodeFleetCampaignSave } from './validate'
import { migrateSave } from './migration'

function storageFailure(message: string, cause: unknown): SaveError {
  return cause instanceof SaveError
    ? cause
    : new SaveError('save_storage_failed', message, { cause })
}

export function createCampaignPersistence(
  store: CampaignSaveStore,
  options: CampaignPersistenceOptions = {},
): CampaignPersistence {
  const migrate = options.migrateSave ?? migrateSave

  return {
    async save(save): Promise<void> {
      const validated = decodeCampaignSave(save)
      try {
        await store.save(validated)
      } catch (error) {
        throw storageFailure('Could not save campaign', error)
      }
    },

    async load(campaignId): Promise<CampaignSave | null> {
      let raw: CampaignSave | null
      try {
        raw = await store.load(campaignId)
      } catch (error) {
        throw storageFailure('Could not load campaign', error)
      }
      return raw === null ? null : decodeCampaignSave(raw)
    },

    async list(): Promise<CampaignSave[]> {
      let saves: CampaignSave[]
      try {
        saves = await store.list()
      } catch (error) {
        throw storageFailure('Could not list campaigns', error)
      }
      return saves.map(decodeCampaignSave).sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    },

    async delete(campaignId): Promise<void> {
      try {
        await store.delete(campaignId)
      } catch (error) {
        throw storageFailure('Could not delete campaign', error)
      }
    },

    async export(campaignId): Promise<string> {
      const save = await this.load(campaignId)
      if (save === null) throw new SaveError('save_not_found', 'Campaign save was not found')
      const envelope: FleetCampaignSave = {
        format: SAVE_FORMAT,
        formatVersion: SAVE_FORMAT_VERSION,
        save,
      }
      return JSON.stringify(envelope)
    },

    async import(serialized): Promise<CampaignSave> {
      if (new TextEncoder().encode(serialized).byteLength > MAX_IMPORT_BYTES) {
        throw new SaveError('save_invalid', 'Import exceeds the size limit')
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(serialized) as unknown
      } catch (error) {
        throw new SaveError('save_invalid', 'Import is not valid JSON', { cause: error })
      }

      // Validation completes before the only storage write, so failed imports cannot overwrite a save.
      const envelope = decodeFleetCampaignSave(parsed)
      if (
        typeof envelope.save !== 'object' ||
        envelope.save === null ||
        Array.isArray(envelope.save) ||
        !Number.isInteger((envelope.save as Record<string, unknown>).schemaVersion)
      ) {
        throw new SaveError('save_invalid', 'Campaign save schema version must be an integer')
      }
      const fromVersion = (envelope.save as Record<string, unknown>).schemaVersion as number
      let migrated: CampaignSave
      try {
        migrated = decodeCampaignSave(migrate(fromVersion, envelope.save))
      } catch (error) {
        throw error instanceof SaveError
          ? error
          : new SaveError('save_invalid', 'Campaign save migration failed', { cause: error })
      }
      try {
        await store.save(migrated)
      } catch (error) {
        throw storageFailure('Could not import campaign', error)
      }
      return structuredClone(migrated)
    },
  }
}
