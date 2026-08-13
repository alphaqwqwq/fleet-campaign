import { useI18n } from '../i18n'

export type HomeAction = 'host' | 'join' | 'demo'

export function HomeScreen({ onSelect }: { onSelect: (action: HomeAction) => void }) {
  const { t } = useI18n()
  return (
    <section className="home">
      <h1>{t('app.title')}</h1>
      <p className="tagline">{t('app.tagline')}</p>
      <div className="home-actions">
        <button className="primary" onClick={() => onSelect('host')}>
          {t('home.createRoom')}
        </button>
        <button className="primary" onClick={() => onSelect('join')}>
          {t('home.joinRoom')}
        </button>
        <button className="ghost" onClick={() => onSelect('demo')}>
          {t('home.demo')}
        </button>
      </div>
      <p className="muted hint">{t('home.demoHint')}</p>
    </section>
  )
}
