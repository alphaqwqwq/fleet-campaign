import { useState } from 'react'

import { useI18n, useClientLangSync } from './i18n'
import { HomeScreen, type HomeAction } from './ui/HomeScreen'
import { HostRoom } from './ui/HostRoom'
import { JoinRoom } from './ui/JoinRoom'
import { DemoMode } from './ui/DemoMode'
import { BattleMode } from './ui/BattleMode'

export function App() {
  const { t, lang, setLang } = useI18n()
  useClientLangSync()
  const [mode, setMode] = useState<HomeAction | null>(null)

  return (
    <main className="page">
      <div className="app-bar">
        <span className="eyebrow">{t('app.title')}</span>
        <button className="lang-toggle" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
          {lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>
      {mode === null ? (
        <HomeScreen onSelect={setMode} />
      ) : mode === 'host' ? (
        <HostRoom onExit={() => setMode(null)} />
      ) : mode === 'join' ? (
        <JoinRoom onExit={() => setMode(null)} />
      ) : mode === 'battle' ? (
        <BattleMode onExit={() => setMode(null)} />
      ) : (
        <DemoMode onExit={() => setMode(null)} />
      )}
    </main>
  )
}
