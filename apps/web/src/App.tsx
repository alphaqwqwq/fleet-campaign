import './App.css'

export const pageStatusText = '房间基础工程准备中'

export function App() {
  return (
    <main className="page">
      <section className="status-card" aria-labelledby="page-title">
        <p className="eyebrow">FLEET CAMPAIGN</p>
        <h1 id="page-title">{pageStatusText}</h1>
        <p>正式项目的工作区、质量门禁与静态部署基线已经就绪。</p>
      </section>
    </main>
  )
}
