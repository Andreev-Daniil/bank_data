import { useState, useEffect } from 'react'
import './index.css'

interface BankData {
  period: string
  'Активы (млрд руб)': string
  'Капитал (млрд руб)': string
  'Чистая прибыль за период (млрд руб)': string
  'Кредитный портфель (млрд руб)': string
  'Просроченная задолженность (млрд руб)': string
  'Вклады физлиц (млрд руб)': string
  'Место по активам': string
  'Место по капиталу': string
}

function App() {
  const [data, setData] = useState<BankData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<string>('Активы (млрд руб)')
  const [sortField, setSortField] = useState<string>('period')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    fetch('/data/gazprombank_ratings.json')
      .then(res => {
        if (!res.ok) throw new Error('Не удалось загрузить данные')
        return res.json()
      })
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const parseNumber = (value: string): number => {
    return parseFloat(value.replace(/\s/g, '').replace(',', '.'))
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const metrics = [
    'Активы (млрд руб)',
    'Капитал (млрд руб)',
    'Чистая прибыль за период (млрд руб)',
    'Кредитный портфель (млрд руб)',
    'Просроченная задолженность (млрд руб)',
    'Вклады физлиц (млрд руб)',
  ]

  const sortedData = [...data].sort((a, b) => {
    const aVal = sortField === 'period' ? a.period : (a as any)[sortField]
    const bVal = sortField === 'period' ? b.period : (b as any)[sortField]
    
    if (sortField === 'period') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal)
    }
    
    const aNum = parseNumber(aVal)
    const bNum = parseNumber(bVal)
    return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
  })

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Данные для графика
  const chartData = data.map(d => ({
    label: formatDate(d.period),
    value: parseNumber((d as any)[selectedMetric])
  }))

  const maxChartValue = Math.max(...chartData.map(d => d.value))
  const minChartValue = Math.min(...chartData.map(d => d.value))

  const exportCSV = () => {
    const headers = ['Период', ...metrics, 'Место по активам', 'Место по капиталу']
    const rows = data.map(d => [
      d.period,
      d['Активы (млрд руб)'],
      d['Капитал (млрд руб)'],
      d['Чистая прибыль за период (млрд руб)'],
      d['Кредитный портфель (млрд руб)'],
      d['Просроченная задолженность (млрд руб)'],
      d['Вклады физлиц (млрд руб)'],
      d['Место по активам'],
      d['Место по капиталу'],
    ])

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'gazprombank_ratings.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Загрузка данных...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error">
        <h2>Ошибка</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <div className="bank-logo">ГПБ</div>
            <div>
              <h1>Газпромбанк</h1>
              <p className="subtitle">Финансовые показатели | Лицензия ЦБ РФ № 354</p>
            </div>
          </div>
          <div className="header-info">
            <span className="badge">Источник: banki.ru</span>
            <span className="badge badge-secondary">Данные с 2022 г.</span>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Summary Cards */}
        <section className="summary-section">
          <h2>Сводные показатели (последний период)</h2>
          <div className="cards-grid">
            {data.length > 0 && (
              <>
                <div className="card card-blue">
                  <div className="card-label">Активы</div>
                  <div className="card-value">{data[data.length - 1]['Активы (млрд руб)']}</div>
                  <div className="card-unit">млрд руб</div>
                </div>
                <div className="card card-green">
                  <div className="card-label">Капитал</div>
                  <div className="card-value">{data[data.length - 1]['Капитал (млрд руб)']}</div>
                  <div className="card-unit">млрд руб</div>
                </div>
                <div className="card card-purple">
                  <div className="card-label">Чистая прибыль</div>
                  <div className="card-value">{data[data.length - 1]['Чистая прибыль за период (млрд руб)']}</div>
                  <div className="card-unit">млрд руб</div>
                </div>
                <div className="card card-orange">
                  <div className="card-label">Кредитный портфель</div>
                  <div className="card-value">{data[data.length - 1]['Кредитный портфель (млрд руб)']}</div>
                  <div className="card-unit">млрд руб</div>
                </div>
                <div className="card card-red">
                  <div className="card-label">Просрочка</div>
                  <div className="card-value">{data[data.length - 1]['Просроченная задолженность (млрд руб)']}</div>
                  <div className="card-unit">млрд руб</div>
                </div>
                <div className="card card-teal">
                  <div className="card-label">Вклады физлиц</div>
                  <div className="card-value">{data[data.length - 1]['Вклады физлиц (млрд руб)']}</div>
                  <div className="card-unit">млрд руб</div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Chart Section */}
        <section className="chart-section">
          <div className="chart-header">
            <h2>Динамика показателей</h2>
            <select 
              className="metric-select"
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value)}
            >
              {metrics.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="chart-container">
            <div className="chart">
              {chartData.map((d, i) => {
                const height = maxChartValue > 0 
                  ? ((d.value - minChartValue) / (maxChartValue - minChartValue)) * 80 + 20 
                  : 50
                return (
                  <div key={i} className="chart-bar-wrapper">
                    <div className="chart-tooltip">
                      {d.value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
                    </div>
                    <div 
                      className="chart-bar"
                      style={{ height: `${height}%` }}
                    ></div>
                    <div className="chart-label">{d.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Table Section */}
        <section className="table-section">
          <div className="table-header">
            <h2>Таблица показателей</h2>
            <button className="btn-export" onClick={exportCSV}>
              📥 Экспорт CSV
            </button>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('period')} className="sortable">
                    Период {sortField === 'period' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  {metrics.map(m => (
                    <th key={m} onClick={() => handleSort(m)} className="sortable">
                      {m} {sortField === m && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                  <th>Место по активам</th>
                  <th>Место по капиталу</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, i) => (
                  <tr key={i}>
                    <td className="period-cell">{formatDate(row.period)}</td>
                    {metrics.map(m => (
                      <td key={m} className="number-cell">{(row as any)[m]}</td>
                    ))}
                    <td className="rank-cell">{row['Место по активам']}</td>
                    <td className="rank-cell">{row['Место по капиталу']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Info Section */}
        <section className="info-section">
          <h2>О данных</h2>
          <div className="info-content">
            <p>
              <strong>Источник данных:</strong> banki.ru (на основании отчётности по данным ЦБ РФ)
            </p>
            <p>
              <strong>Банк:</strong> АО «Газпромбанк» (лицензия № 354)
            </p>
            <p>
              <strong>Период:</strong> с января 2022 года по текущий момент (ежеквартально)
            </p>
            <p>
              <strong>ID банка на banki.ru:</strong> 2764
            </p>
            <p className="note">
              ⚠️ Примечание: Данные получены из открытых источников. Для верификации 
              рекомендуется проверить актуальные показатели на сайте{' '}
              <a href="https://www.banki.ru/banks/ratings/?BANK_ID=2764" target="_blank" rel="noopener">
                banki.ru
              </a>{' '}
              или на сайте{' '}
              <a href="https://www.cbr.ru" target="_blank" rel="noopener">
                ЦБ РФ
              </a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Данные парсинга banki.ru | Газпромбанк | 2022–2026</p>
      </footer>
    </div>
  )
}

export default App
