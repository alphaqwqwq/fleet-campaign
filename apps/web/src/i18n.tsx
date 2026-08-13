import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'zh' | 'en'

const LANG_STORAGE_KEY = 'fleet-campaign:lang'

export const zh = {
  'app.title': 'FLEET CAMPAIGN',
  'app.tagline': '网页联机电子桌游 · demo-v1 垂直切片',
  'home.createRoom': '创建房间（房主）',
  'home.joinRoom': '加入房间（玩家 / 观战）',
  'home.battle': 'M2 交战（单指挥 vs AI）',
  'home.battleHint': '进程内驱动 M2 交战引擎 + 状态机 bot：指挥我方，AI 自动指挥敌方。',
  'home.demo': '单机演示（双面板）',
  'home.demoHint': '同一页面内模拟房主 + 客机，内存传输，用于快速自测；不测真实网络。',
  'demo.reset': '重置演示',
  'demo.hostPane': '房主面板',
  'demo.guestPane': '客机面板',
  'host.roomCode': '房间码',
  'host.roomCodeHint': '复制发给加入者，加入者手动输入即可。',
  'host.campaignId': '战役档 ID',
  'host.waitingPlayer': '等待玩家加入…',
  'host.startDemo': '开始演示对局',
  'host.advance': '执行行动（advance）',
  'host.closeRoom': '关闭房间',
  'host.playerJoined': '玩家已加入',
  'host.connectedClients': '已连接',
  'host.save': '保存当前进度',
  'host.export': '导出存档',
  'host.import': '导入存档',
  'host.saved': '已保存',
  'host.loadHint': '从列表恢复一个已保存的对局（需在新房间内继续）。',
  'host.noSaves': '暂无本地存档',
  'host.resume': '恢复此存档',
  'join.roomCodeLabel': '输入房间码',
  'join.roomCodePlaceholder': '例如 r_xxxx…',
  'join.roleLabel': '选择身份',
  'join.rolePlayer': '玩家',
  'join.roleSpectator': '观战者',
  'join.submit': '加入',
  'join.reconnect': '重新连接',
  'join.leave': '离开房间',
  'join.waiting': '正在连接…',
  'board.round': '回合',
  'board.actionPoints': '行动点',
  'board.activeSeat': '行动方',
  'board.integrity': '完整性',
  'board.hostUnit': '房主单位',
  'board.guestUnit': '客机单位',
  'board.yourTurn': '轮到你行动',
  'board.waitingTurn': '等待对方行动…',
  'board.spectating': '观战模式（只读）',
  'board.completed': '对局结束',
  'board.winner': '胜者',
  'board.events': '事件记录',
  'status.connecting': '连接中',
  'status.joining': '正在加入',
  'status.connected': '已连接',
  'status.reconnecting': '重连中',
  'status.disconnected': '已断开',
  'status.closed': '会话已结束',
  'status.duplicate': '连接被新连接替换',
  'status.unavailable': '传输不可用',
  'error.protocol_invalid': '传输消息不合法',
  'error.room_not_found': '房间不存在',
  'error.room_mismatch': '房间不匹配',
  'error.identity_invalid': '身份校验失败，请重新加入',
  'error.forbidden_role': '当前角色无权执行此操作',
  'error.state_conflict': '状态已更新，请重试',
  'error.phase_mismatch': '当前阶段不允许该操作',
  'error.not_active_seat': '还没轮到你行动',
  'error.command_invalid': '操作不合法',
  'error.room_closed': '房间已关闭',
  'error.transport_unavailable': '连接不可用',
  'error.player_seat_unavailable': '玩家席位已满，只能观战',
  'error.save_invalid': '存档不合法',
  'error.save_unsupported_version': '存档版本不支持',
  'error.save_incompatible_content': '存档内容与当前游戏不兼容',
  'error.save_not_found': '未找到该存档',
  'error.save_storage_failed': '存档写入失败',
  'error.realtime.transport_unavailable': '无法连接房主',
  'error.realtime.identity_invalid': '身份校验失败，请重新加入',
} as const

export type I18nKey = keyof typeof zh

const en: Record<I18nKey, string> = {
  'app.title': 'FLEET CAMPAIGN',
  'app.tagline': 'Online digital tabletop · demo-v1 vertical slice',
  'home.createRoom': 'Create room (host)',
  'home.joinRoom': 'Join room (player / spectator)',
  'home.battle': 'M2 battle (single command vs AI)',
  'home.battleHint': 'Drives the M2 battle engine + state-machine bot in-process: you command your fleet, AI plays the enemy.',
  'home.demo': 'Local demo (dual panel)',
  'home.demoHint': 'Simulates host + guest in one page over an in-memory transport; for quick self-testing, not real networking.',
  'demo.reset': 'Reset demo',
  'demo.hostPane': 'Host panel',
  'demo.guestPane': 'Guest panel',
  'host.roomCode': 'Room code',
  'host.roomCodeHint': 'Copy and send to the guest; they type it in manually.',
  'host.campaignId': 'Campaign ID',
  'host.waitingPlayer': 'Waiting for a player to join…',
  'host.startDemo': 'Start demo game',
  'host.advance': 'Advance',
  'host.closeRoom': 'Close room',
  'host.playerJoined': 'A player has joined',
  'host.connectedClients': 'Connected',
  'host.save': 'Save progress',
  'host.export': 'Export save',
  'host.import': 'Import save',
  'host.saved': 'Saved',
  'host.loadHint': 'Resume a saved game from the list (continues in a new room).',
  'host.noSaves': 'No local saves',
  'host.resume': 'Resume',
  'join.roomCodeLabel': 'Room code',
  'join.roomCodePlaceholder': 'e.g. r_xxxx…',
  'join.roleLabel': 'Role',
  'join.rolePlayer': 'Player',
  'join.roleSpectator': 'Spectator',
  'join.submit': 'Join',
  'join.reconnect': 'Reconnect',
  'join.leave': 'Leave room',
  'join.waiting': 'Connecting…',
  'board.round': 'Round',
  'board.actionPoints': 'Action points',
  'board.activeSeat': 'Active',
  'board.integrity': 'Integrity',
  'board.hostUnit': 'Host unit',
  'board.guestUnit': 'Guest unit',
  'board.yourTurn': 'Your turn',
  'board.waitingTurn': 'Waiting for the opponent…',
  'board.spectating': 'Spectator mode (read-only)',
  'board.completed': 'Game over',
  'board.winner': 'Winner',
  'board.events': 'Events',
  'status.connecting': 'Connecting',
  'status.joining': 'Joining',
  'status.connected': 'Connected',
  'status.reconnecting': 'Reconnecting',
  'status.disconnected': 'Disconnected',
  'status.closed': 'Session ended',
  'status.duplicate': 'Replaced by a newer connection',
  'status.unavailable': 'Transport unavailable',
  'error.protocol_invalid': 'Invalid transport message',
  'error.room_not_found': 'Room not found',
  'error.room_mismatch': 'Room mismatch',
  'error.identity_invalid': 'Identity check failed, please rejoin',
  'error.forbidden_role': 'Your role cannot do that',
  'error.state_conflict': 'State updated, please retry',
  'error.phase_mismatch': 'Not allowed in the current phase',
  'error.not_active_seat': 'Not your turn yet',
  'error.command_invalid': 'Invalid action',
  'error.room_closed': 'Room closed',
  'error.transport_unavailable': 'Connection unavailable',
  'error.player_seat_unavailable': 'Player seat is full, join as spectator',
  'error.save_invalid': 'Invalid save',
  'error.save_unsupported_version': 'Unsupported save version',
  'error.save_incompatible_content': 'Save is incompatible with this game',
  'error.save_not_found': 'Save not found',
  'error.save_storage_failed': 'Failed to store save',
  'error.realtime.transport_unavailable': 'Cannot reach the host',
  'error.realtime.identity_invalid': 'Identity check failed, please rejoin',
}

export const translations: Record<Lang, Record<I18nKey, string>> = { zh, en }

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: I18nKey, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readStoredLang(): Lang {
  const stored = globalThis.localStorage?.getItem(LANG_STORAGE_KEY)
  return stored === 'en' ? 'en' : 'zh'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang())

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, next)
  }, [])

  const t = useCallback(
    (key: I18nKey, params?: Record<string, string>): string => {
      let text: string = translations[lang][key]
      if (text === undefined) text = translations.zh[key]
      if (text === undefined) text = key
      if (params) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, value)
      return text
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}

/** 稳定的 messageKey → 文案 key 映射（前缀 `error.`，未知则回退通用错误）。 */
export function messageKeyToI18nKey(messageKey: string): I18nKey {
  const key = `error.${messageKey}`
  return key in zh ? (key as I18nKey) : 'error.protocol_invalid'
}

export function useClientLangSync(): void {
  const { lang } = useI18n()
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
}
