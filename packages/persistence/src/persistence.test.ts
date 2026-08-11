import { describe, expect, it } from 'vitest'

import {
  MAX_IMPORT_BYTES,
  LocalStorageCampaignStore,
  SaveError,
  createCampaignPersistence,
  decodeCampaignSave,
  migrateSave,
  type CampaignSave,
  type CampaignSaveStore,
} from './index'

const CAMPAIGN_ID = 'c_123e4567-e89b-42d3-a456-426614174000'
const RNG_SEED = 'AAAAAAAAAAAAAAAAAAAAAA'

function fixture(overrides: Partial<CampaignSave> = {}): CampaignSave {
  return {
    schemaVersion: 1,
    campaignId: CAMPAIGN_ID,
    contentId: 'demo-v1',
    savedAt: '2026-08-11T00:00:00.000Z',
    gameSnapshot: {
      contentId: 'demo-v1',
      phase: 'active',
      round: 1,
      activeSeat: 'host',
      actionPoints: 1,
      units: [
        { id: 'host-unit', integrity: 3 },
        { id: 'guest-unit', integrity: 3 },
      ],
      winnerSeat: null,
    },
    rngState: { seed: RNG_SEED, index: 0 },
    migrationMetadata: { migratedFrom: null },
    ...overrides,
  }
}

class MemoryStore implements CampaignSaveStore {
  readonly saves = new Map<string, CampaignSave>()
  writes = 0

  async save(save: CampaignSave): Promise<void> {
    this.writes += 1
    this.saves.set(save.campaignId, structuredClone(save))
  }

  async load(campaignId: string): Promise<CampaignSave | null> {
    return structuredClone(this.saves.get(campaignId) ?? null)
  }

  async list(): Promise<CampaignSave[]> {
    return structuredClone([...this.saves.values()])
  }

  async delete(campaignId: string): Promise<void> {
    this.saves.delete(campaignId)
  }
}

function exported(save: unknown, envelope: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: 'fleet-campaign-save', formatVersion: 1, save, ...envelope })
}

async function expectCode(operation: Promise<unknown>, code: SaveError['code']): Promise<void> {
  await expect(operation).rejects.toMatchObject({ code })
}

describe('campaign persistence', () => {
  it('round-trips, lists by savedAt, exports, imports and deletes v1 saves', async () => {
    const source = new MemoryStore()
    const persistence = createCampaignPersistence(source)
    const older = fixture()
    const newer = fixture({
      campaignId: 'c_223e4567-e89b-42d3-a456-426614174000',
      savedAt: '2026-08-12T00:00:00.000Z',
    })

    await persistence.save(older)
    await persistence.save(newer)
    expect(await persistence.load(CAMPAIGN_ID)).toEqual(older)
    expect((await persistence.list()).map((save) => save.campaignId)).toEqual([newer.campaignId, CAMPAIGN_ID])

    const serialized = await persistence.export(CAMPAIGN_ID)
    expect(serialized).not.toMatch(/roomId|clientId|token|receipt|peer/i)
    const destination = new MemoryStore()
    expect(await createCampaignPersistence(destination).import(serialized)).toEqual(older)
    expect(destination.saves.get(CAMPAIGN_ID)).toEqual(older)

    await persistence.delete(CAMPAIGN_ID)
    expect(await persistence.load(CAMPAIGN_ID)).toBeNull()
  })

  it.each([
    ['roomId', 'r_abcdefghijkl'],
    ['clientId', 'u_123e4567-e89b-42d3-a456-426614174000'],
    ['token', 'secret'],
    ['commandReceipts', []],
    ['connectionState', 'connected'],
    ['peerEndpoint', 'peer'],
    ['credential', 'secret'],
    ['narrationInput', 'secret'],
  ])('rejects prohibited save field %s', (field, value) => {
    expect(() => decodeCampaignSave({ ...fixture(), [field]: value })).toThrowError(
      expect.objectContaining({ code: 'save_invalid' }),
    )
  })

  it('rejects malformed JSON and oversized UTF-8 before writing', async () => {
    const store = new MemoryStore()
    const persistence = createCampaignPersistence(store)
    await expectCode(persistence.import('{'), 'save_invalid')
    await expectCode(persistence.import('x'.repeat(MAX_IMPORT_BYTES + 1)), 'save_invalid')
    expect(store.writes).toBe(0)
  })

  it('does not overwrite when migration throws', async () => {
    const original = fixture()
    const store = new MemoryStore()
    store.saves.set(CAMPAIGN_ID, structuredClone(original))
    const persistence = createCampaignPersistence(store, {
      migrateSave: () => {
        throw new Error('migration failed')
      },
    })

    await expectCode(persistence.import(exported(fixture({ savedAt: '2026-08-13T00:00:00.000Z' }))), 'save_invalid')
    expect(store.writes).toBe(0)
    expect(store.saves.get(CAMPAIGN_ID)).toEqual(original)
  })

  it('passes an older raw save to the migrator before decoding it', async () => {
    const store = new MemoryStore()
    const raw = { schemaVersion: 0, legacy: true }
    let received: { fromVersion: number; raw: unknown } | undefined
    const persistence = createCampaignPersistence(store, {
      migrateSave: (fromVersion, migrationRaw) => {
        received = { fromVersion, raw: migrationRaw }
        return fixture()
      },
    })

    expect(await persistence.import(exported(raw))).toEqual(fixture())
    expect(received).toEqual({ fromVersion: 0, raw })
    expect(store.writes).toBe(1)
  })

  it.each([
    ['unknown field', { ...fixture(), unexpected: true }],
    ['invalid RNG', { ...fixture(), rngState: { seed: 'short', index: 0 } }],
    ['invalid domain state', { ...fixture(), gameSnapshot: { ...fixture().gameSnapshot, actionPoints: 0 } }],
  ])('rejects migrator output with %s without writing', async (_scenario, migrated) => {
    const store = new MemoryStore()
    const original = fixture()
    store.saves.set(CAMPAIGN_ID, structuredClone(original))
    const persistence = createCampaignPersistence(store, {
      migrateSave: () => migrated as CampaignSave,
    })

    await expectCode(persistence.import(exported({ schemaVersion: 0, legacy: true })), 'save_invalid')
    expect(store.writes).toBe(0)
    expect(store.saves.get(CAMPAIGN_ID)).toEqual(original)
  })

  it.each([undefined, null, '1', -1, 1.5])('rejects invalid schemaVersion %s before migration', async (schemaVersion) => {
    const store = new MemoryStore()
    let migrations = 0
    const persistence = createCampaignPersistence(store, {
      migrateSave: () => {
        migrations += 1
        return fixture()
      },
    })

    await expectCode(persistence.import(exported({ schemaVersion })), 'save_invalid')
    expect(migrations).toBe(0)
    expect(store.writes).toBe(0)
  })

  it('classifies a structurally complete future integer version as unsupported without writing', async () => {
    const store = new MemoryStore()
    await expectCode(createCampaignPersistence(store).import(exported({ ...fixture(), schemaVersion: 2 })), 'save_unsupported_version')
    expect(store.writes).toBe(0)
  })

  it.each([
    ['unknown package version', { formatVersion: 2 }, 'save_unsupported_version'],
    ['unknown save version', {}, 'save_unsupported_version'],
    ['incompatible content', {}, 'save_incompatible_content'],
    ['invalid rng seed', {}, 'save_invalid'],
    ['invalid domain invariant', {}, 'save_invalid'],
  ] as const)('rejects %s without overwriting', async (scenario, envelopeOverride, code) => {
    const original = fixture()
    const store = new MemoryStore()
    store.saves.set(CAMPAIGN_ID, structuredClone(original))
    const persistence = createCampaignPersistence(store)
    let imported: Record<string, unknown> = fixture({
      savedAt: '2026-08-13T00:00:00.000Z',
    }) as unknown as Record<string, unknown>
    if (scenario === 'unknown save version') imported = { ...imported, schemaVersion: 2 }
    if (scenario === 'incompatible content') imported = { ...imported, contentId: 'future-content' }
    if (scenario === 'invalid rng seed') imported = { ...imported, rngState: { seed: 'short', index: 0 } }
    if (scenario === 'invalid domain invariant') {
      imported = { ...imported, gameSnapshot: { ...fixture().gameSnapshot, actionPoints: 0 } }
    }

    await expectCode(persistence.import(exported(imported, envelopeOverride)), code)
    expect(store.writes).toBe(0)
    expect(store.saves.get(CAMPAIGN_ID)).toEqual(original)
  })

  it('rejects unknown fields at every persisted boundary', () => {
    expect(() => decodeCampaignSave({
      ...fixture(),
      gameSnapshot: { ...fixture().gameSnapshot, token: 'secret' },
    })).toThrowError(expect.objectContaining({ code: 'save_invalid' }))
    expect(() => decodeCampaignSave({
      ...fixture(),
      rngState: { ...fixture().rngState, cursor: 0 },
    })).toThrowError(expect.objectContaining({ code: 'save_invalid' }))
  })

  it('rejects non-canonical timestamps, RNG seeds and consumed demo-v1 RNG state', () => {
    expect(() => decodeCampaignSave(fixture({ savedAt: '2026-08-11' }))).toThrowError(
      expect.objectContaining({ code: 'save_invalid' }),
    )
    expect(() => decodeCampaignSave(fixture({ rngState: { seed: 'AAAAAAAAAAAAAAAAAAAAAB', index: 0 } }))).toThrowError(
      expect.objectContaining({ code: 'save_invalid' }),
    )
    expect(() => decodeCampaignSave(fixture({ rngState: { seed: RNG_SEED, index: 1 } }))).toThrowError(
      expect.objectContaining({ code: 'save_invalid' }),
    )
  })

  it.each([
    ['awaiting-player', fixture({ gameSnapshot: { ...fixture().gameSnapshot, phase: 'awaiting-player', round: 0, activeSeat: null, actionPoints: 0 } })],
    ['active', fixture()],
    ['completed', fixture({ gameSnapshot: { ...fixture().gameSnapshot, phase: 'completed', round: 3, activeSeat: null, actionPoints: 0, units: [{ id: 'host-unit', integrity: 1 }, { id: 'guest-unit', integrity: 0 }], winnerSeat: 'host' } })],
    ['closed', fixture({ gameSnapshot: { ...fixture().gameSnapshot, phase: 'closed', activeSeat: null, actionPoints: 0 } })],
  ] as const)('accepts reachable %s phase snapshots', (_phase, save) => {
    expect(decodeCampaignSave(save)).toEqual(save)
  })

  it.each([
    ['awaiting-player nonzero round', { phase: 'awaiting-player', round: 1, activeSeat: null, actionPoints: 0 }],
    ['awaiting-player damaged unit', { phase: 'awaiting-player', round: 0, activeSeat: null, actionPoints: 0, units: [{ id: 'host-unit', integrity: 2 }, { id: 'guest-unit', integrity: 3 }] }],
    ['active zero round', { phase: 'active', round: 0, activeSeat: 'host', actionPoints: 1 }],
    ['active defeated unit', { phase: 'active', round: 2, activeSeat: 'guest', actionPoints: 1, units: [{ id: 'host-unit', integrity: 0 }, { id: 'guest-unit', integrity: 2 }] }],
    ['completed zero round', { phase: 'completed', round: 0, activeSeat: null, actionPoints: 0, units: [{ id: 'host-unit', integrity: 1 }, { id: 'guest-unit', integrity: 0 }], winnerSeat: 'host' }],
    ['completed defeated winner', { phase: 'completed', round: 3, activeSeat: null, actionPoints: 0, units: [{ id: 'host-unit', integrity: 0 }, { id: 'guest-unit', integrity: 0 }], winnerSeat: 'host' }],
    ['closed winner', { phase: 'closed', activeSeat: null, actionPoints: 0, winnerSeat: 'host' }],
  ] as const)('rejects unreachable %s snapshots', (_scenario, gameOverrides) => {
    expect(() => decodeCampaignSave({
      ...fixture(),
      gameSnapshot: { ...fixture().gameSnapshot, ...gameOverrides },
    })).toThrowError(expect.objectContaining({ code: 'save_invalid' }))
  })

  it('exposes an explicit v1 migration boundary and rejects unsupported migration', () => {
    expect(migrateSave(1, fixture())).toEqual(fixture())
    expect(() => migrateSave(2, fixture())).toThrowError(
      expect.objectContaining({ code: 'save_unsupported_version' }),
    )
  })

  it('validates storage records on load without replacing them', async () => {
    const store = new MemoryStore()
    store.saves.set(CAMPAIGN_ID, { ...fixture(), schemaVersion: 2 } as unknown as CampaignSave)
    await expectCode(createCampaignPersistence(store).load(CAMPAIGN_ID), 'save_unsupported_version')
    expect(store.writes).toBe(0)
  })
})

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('localStorage campaign store', () => {
  it('stores, loads, lists and deletes saves through injected browser storage', async () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageCampaignStore({ storage })
    const save = fixture()

    await store.save(save)
    expect(await store.load(CAMPAIGN_ID)).toEqual(save)
    expect(await store.list()).toEqual([save])
    await createCampaignPersistence(store).delete(CAMPAIGN_ID)
    expect(await store.load(CAMPAIGN_ID)).toBeNull()
  })

  it('isolates corrupt and unsupported records without deleting them', async () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageCampaignStore({ storage })
    await store.save(fixture())
    storage.setItem('fleet-campaign:save:corrupt', '{')
    storage.setItem('fleet-campaign:save:future', JSON.stringify({ ...fixture(), schemaVersion: 2 }))

    expect(await store.list()).toEqual([fixture()])
    expect(storage.getItem('fleet-campaign:save:corrupt')).toBe('{')
    expect(storage.getItem('fleet-campaign:save:future')).not.toBeNull()
  })

  it('reports a corrupt requested record as invalid without deleting it', async () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageCampaignStore({ storage })
    storage.setItem(`fleet-campaign:save:${CAMPAIGN_ID}`, '{')

    await expectCode(createCampaignPersistence(store).load(CAMPAIGN_ID), 'save_invalid')
    expect(storage.getItem(`fleet-campaign:save:${CAMPAIGN_ID}`)).toBe('{')
  })

  it('rejects load and export when the storage key does not match the payload without deleting it', async () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageCampaignStore({ storage })
    const mismatched = fixture({ campaignId: 'c_223e4567-e89b-42d3-a456-426614174000' })
    const key = `fleet-campaign:save:${CAMPAIGN_ID}`
    const serialized = JSON.stringify(mismatched)
    storage.setItem(key, serialized)
    const persistence = createCampaignPersistence(store)

    await expectCode(persistence.load(CAMPAIGN_ID), 'save_invalid')
    await expectCode(persistence.export(CAMPAIGN_ID), 'save_invalid')
    expect(storage.getItem(key)).toBe(serialized)
  })

  it('isolates key/payload mismatches from lists and deletes only the requested key', async () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageCampaignStore({ storage })
    const otherId = 'c_223e4567-e89b-42d3-a456-426614174000'
    const mismatchedKey = `fleet-campaign:save:${CAMPAIGN_ID}`
    const otherKey = `fleet-campaign:save:${otherId}`
    const serialized = JSON.stringify(fixture({ campaignId: otherId }))
    storage.setItem(mismatchedKey, serialized)
    storage.setItem(otherKey, serialized)

    expect(await createCampaignPersistence(store).list()).toEqual([fixture({ campaignId: otherId })])
    expect(storage.getItem(mismatchedKey)).toBe(serialized)

    await store.delete(CAMPAIGN_ID)
    expect(storage.getItem(mismatchedKey)).toBeNull()
    expect(storage.getItem(otherKey)).toBe(serialized)
  })
})
