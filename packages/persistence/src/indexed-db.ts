import type { CampaignSave, CampaignSaveStore } from './types'

export interface IndexedDbCampaignStoreOptions {
  databaseName?: string
  indexedDB?: IDBFactory
}

const STORE_NAME = 'campaign-saves'

export class IndexedDbCampaignStore implements CampaignSaveStore {
  readonly #databaseName: string
  readonly #indexedDB: IDBFactory
  #database: Promise<IDBDatabase> | undefined

  constructor(options: IndexedDbCampaignStoreOptions = {}) {
    this.#databaseName = options.databaseName ?? 'fleet-campaign'
    this.#indexedDB = options.indexedDB ?? globalThis.indexedDB
    if (!this.#indexedDB) throw new Error('IndexedDB is unavailable')
  }

  async save(save: CampaignSave): Promise<void> {
    const database = await this.#open()
    await transactionRequest(database, 'readwrite', (store) => store.put(structuredClone(save)))
  }

  async load(campaignId: string): Promise<CampaignSave | null> {
    const database = await this.#open()
    const result = await transactionRequest(database, 'readonly', (store) => store.get(campaignId))
    return result === undefined ? null : (structuredClone(result) as CampaignSave)
  }

  async list(): Promise<CampaignSave[]> {
    const database = await this.#open()
    const result = await transactionRequest(database, 'readonly', (store) => store.getAll())
    return structuredClone(result) as CampaignSave[]
  }

  async delete(campaignId: string): Promise<void> {
    const database = await this.#open()
    await transactionRequest(database, 'readwrite', (store) => store.delete(campaignId))
  }

  #open(): Promise<IDBDatabase> {
    this.#database ??= new Promise((resolve, reject) => {
      const request = this.#indexedDB.open(this.#databaseName, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'campaignId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
      request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked'))
    })
    return this.#database
  }
}

function transactionRequest(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let request: IDBRequest
    try {
      const transaction = database.transaction(STORE_NAME, mode)
      request = operation(transaction.objectStore(STORE_NAME))
      transaction.oncomplete = () => {
        resolve(request.result)
      }
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    } catch (error) {
      reject(error)
      return
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}
