import type { GameView } from '@fleet-campaign/protocol'

export const CAMPAIGN_SCHEMA_VERSION = 1 as const
export const SAVE_FORMAT = 'fleet-campaign-save' as const
export const SAVE_FORMAT_VERSION = 1 as const
export const MAX_IMPORT_BYTES = 1024 * 1024

export interface RngState {
  /** Unpadded base64url encoding of the host-generated 128-bit seed. */
  seed: string
  index: number
}

export interface MigrationMetadata {
  migratedFrom: number | null
}

export interface CampaignSave {
  schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION
  campaignId: string
  contentId: 'demo-v1'
  savedAt: string
  gameSnapshot: GameView
  rngState: RngState
  migrationMetadata: MigrationMetadata
}

export interface FleetCampaignSave {
  format: typeof SAVE_FORMAT
  formatVersion: typeof SAVE_FORMAT_VERSION
  save: CampaignSave
}

export type SaveErrorCode =
  | 'save_invalid'
  | 'save_unsupported_version'
  | 'save_incompatible_content'
  | 'save_not_found'
  | 'save_storage_failed'

export class SaveError extends Error {
  readonly code: SaveErrorCode

  constructor(code: SaveErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SaveError'
    this.code = code
  }
}

export interface CampaignSaveStore {
  save(save: CampaignSave): Promise<void>
  load(campaignId: string): Promise<CampaignSave | null>
  list(): Promise<CampaignSave[]>
  delete(campaignId: string): Promise<void>
}

export interface CampaignPersistence extends CampaignSaveStore {
  export(campaignId: string): Promise<string>
  import(serialized: string): Promise<CampaignSave>
}

export type CampaignSaveMigrator = (fromVersion: number, raw: unknown) => CampaignSave

export interface CampaignPersistenceOptions {
  migrateSave?: CampaignSaveMigrator
}
