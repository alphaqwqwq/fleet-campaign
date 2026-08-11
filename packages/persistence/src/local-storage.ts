import { SaveError, type CampaignSave, type CampaignSaveStore } from './types'
import { decodeCampaignSave } from './validate'

export interface StorageLike {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LocalStorageCampaignStoreOptions {
  keyPrefix?: string
  storage?: StorageLike
}

/** Browser storage adapter injected into the application service; UI code never accesses storage directly. */
export class LocalStorageCampaignStore implements CampaignSaveStore {
  readonly #keyPrefix: string
  readonly #storage: StorageLike

  constructor(options: LocalStorageCampaignStoreOptions = {}) {
    this.#keyPrefix = options.keyPrefix ?? 'fleet-campaign:save:'
    this.#storage = options.storage ?? globalThis.localStorage
    if (!this.#storage) throw new Error('localStorage is unavailable')
  }

  async save(save: CampaignSave): Promise<void> {
    this.#storage.setItem(this.#key(save.campaignId), JSON.stringify(save))
  }

  async load(campaignId: string): Promise<CampaignSave | null> {
    const serialized = this.#storage.getItem(this.#key(campaignId))
    if (serialized === null) return null
    try {
      return JSON.parse(serialized) as CampaignSave
    } catch (error) {
      throw new SaveError('save_invalid', 'Stored campaign is not valid JSON', { cause: error })
    }
  }

  async list(): Promise<CampaignSave[]> {
    const saves: CampaignSave[] = []
    for (let index = 0; index < this.#storage.length; index += 1) {
      const key = this.#storage.key(index)
      if (!key?.startsWith(this.#keyPrefix)) continue
      const serialized = this.#storage.getItem(key)
      if (serialized === null) continue
      try {
        saves.push(decodeCampaignSave(JSON.parse(serialized) as unknown))
      } catch {
        // Corrupt and unsupported records remain stored but are isolated from valid listings.
      }
    }
    return saves
  }

  async delete(campaignId: string): Promise<void> {
    this.#storage.removeItem(this.#key(campaignId))
  }

  #key(campaignId: string): string {
    return `${this.#keyPrefix}${campaignId}`
  }
}
