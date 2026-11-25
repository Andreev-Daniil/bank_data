import { useState, useEffect } from 'react'
import './index.css'

interface BankRecord {
  period: string
  assets: number
  capital: number
  core_capital: number
  additional_capital: number
  profit: number
  loan_portfolio: number
  overdue: number
  deposits_individuals: number
}

interface Bank {
  bank_id: number
  name: string
  full_name: string
  license: string
  is_szk: boolean
  data: BankRecord[]
}

interface BankDataFile {
  metadata: {
    title: string
    source: string
    period: string
    generated: string
    normatives: {
      N1_0_min: number
      N1_1_min: number
      N1_2_min: number
      description: string
    }
  }
  banks: Bank[]
}

function App() {
  const [data, setData] = useState<BankDataFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBank, setSelectedBank] = useState<number>(0)
  const [selectedMetric, setSelectedMetric] = useState<string>('capital')
  const [sortField, setSortField] = useState<string>('period')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    fetch('/data/systemic_banks.json')
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

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const formatNumber = (value: number): string => {
    return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
  }

  // Расчёт нормативов достаточности капитала
  const calculateNormatives = (record: BankRecord) => {
    const N1_0 = (record.capital / record.assets) * 100
    const N1_1 = (record.core_capital / record.assets) * 100
    const N1_2 = (record.additional_capital / record.assets) * 100
    return { N1_0, N1_1, N1_2 }
  }

  const getMetricValue = (record: BankRecord, metric: string): number => {
    switch (metric) {
      case 'assets': return record.assets
      case 'capital': return record.capital
      case 'core_capital': return record.core_capital
      case 'additional_capital': return record.additional_capital
      case 'profit': return record.profit
      case 'loan_portfolio': return record.loan_portfolio
      case 'overdue': return record.overdue
      case 'deposits_individuals': return record.deposits_individuals
      case 'N1_0': return calculateNormatives(record).N1_0
      case 'N1_1': return calculateNormatives(record).N1_1
      case 'N1_2': return calculateNormatives(record).N1_2
      default: return 0
    }
  }

  const getMetricLabel = (metric: string): string => {
    const labels: Record<string, string> = {
      'assets': 'Активы, млрд руб',
      'capital': 'Капитал, млрд руб',
      'core_capital': 'Основный капитал, млрд руб',
      'additional_capital': 'Доп. капитал, млрд руб',
      'profit': 'Чистая прибыль, млрд руб',
      'loan_portfolio': 'Кредитный портфель, млрд руб',
      'overdue': 'Просрочка, млрд руб',
      'deposits_individuals': 'Вклады физлиц, млрд руб',
      'N1_0': 'Н1.0 (достаточность капитала), %',
      'N1_1': 'Н1.1 (достаточность осн. капитала), %',
      'N1_2': 'Н1.2 (достаточность доп. капитала), %',
    }
    return labels[metric] || metric
  }

  const metrics = [
    'assets', 'capital', 'core_capital', 'additional_capital',
    'profit', 'loan_portfolio', 'overdue', 'deposits_individuals',
    'N1_0', 'N1_1', 'N1_2'
  ]

  const sortedData = data ? [...data.banks[selectedBank].data].sort((a, b) => {
    const aVal = sortField === 'period' ? a.period : getMetricValue(a, sortField)
    const bVal = sortField === 'period' ? b.period : getMetricValue(b, sortField)
    
    if (sortField === 'period') {
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal)) 
        : String(bVal).localeCompare(String(aVal))
    }
    
    return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
  }) : []

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const exportCSV = () => {
    if (!data) return
    const bank = data.banks[selectedBank]
    const headers = ['Период', 'Активы', 'Капитал', 'Осн. капитал', 'Доп. капитал', 'Прибыль', 'Кред. портфель', 'Просрочка', 'Вклады физлиц', 'Н1.0 %', 'Н1.1 %', 'Н1.2 %']
    const rows = bank.data.map(d => {
      const n = calculateNormatives(d)
      return [
        d.period, d.assets, d.capital, d.core_capital, d.additional_capital,
        d.profit, d.loan_portfolio, d.overdue, d.deposits_individuals,
        n.N1_0.toFixed(2), n.N1_1.toFixed(2), n.N1_2.toFixed(2)
      ].join(';')
    })
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${bank.name}_financials.csv`
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

  if (error || !data) {
    return (
      <div className="error">
        <h2>Ошибка</h2>
        <p>{error || 'Данные не загружены'}</p>
      </div>
    )
  }

  const currentBank = data.banks[selectedBank]
  const latestData = currentBank.data[currentBank.data.length - 1]
  const normatives = calculateNormatives(latestData)

  // Данные для графика
  const chartData = currentBank.data.map(d => ({
    label: formatDate(d.period),
    value: getMetricValue(d, selectedMetric)
  }))
  const maxChartValue = Math.max(...chartData.map(d => d.value))
  const minChartValue = Math.min(...chartData.map(d => d.value))

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <div className="bank-logo">ЦБ</div>
            <div>
              <h1>Системно значимые банки РФ</h1>
              <p className="subtitle">Финансовые показатели и нормативы достаточности капитала | 2022–2026</p>
            </div>
          </div>
          <div className="header-info">
            <span className="badge">Источник: banki.ru / ЦБ РФ</span>
            <span className="badge badge-secondary">13 банков</span>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Bank Selector */}
        <section className="bank-selector-section">
          <h2>Выбор банка</h2>
          <div className="bank-tabs">
            {data.banks.map((bank, i) => (
              <button
                key={bank.bank_id}
                className={`bank-tab ${i === selectedBank ? 'active' : ''}`}
                onClick={() => setSelectedBank(i)}
              >
                {bank.name}
              </button>
            ))}
          </div>
        </section>

        {/* Bank Info */}
        <section className="bank-info-section">
          <div className="bank-info-card">
            <h3>{currentBank.full_name}</h3>
            <div className="bank-meta">
              <span>Лицензия ЦБ РФ: № {currentBank.license}</span>
              <span>ID banki.ru: {currentBank.bank_id}</span>
              <span className="szk-badge">СЗКО ✓</span>
            </div>
          </div>
        </section>

        {/* Normatives Section */}
        <section className="normatives-section">
          <h2>Нормативы достаточности капитала (последний период: {formatDate(latestData.period)})</h2>
          <div className="normatives-info">
            <p className="normatives-description">
              {data.metadata.normatives.description}
            </p>
          </div>
          <div className="normatives-grid">
            <div className={`normative-card ${normatives.N1_0 >= data.metadata.normatives.N1_0_min ? 'compliant' : 'non-compliant'}`}>
              <div className="normative-header">
                <span className="normative-name">Н1.0</span>
                <span className="normative-type">Достаточность капитала</span>
              </div>
              <div className="normative-value">{normatives.N1_0.toFixed(2)}%</div>
              <div className="normative-min">
                Мин.: {data.metadata.normatives.N1_0_min}%
                {normatives.N1_0 >= data.metadata.normatives.N1_0_min 
                  ? <span className="status-ok"> ✓ Соответствует</span>
                  : <span className="status-fail"> ✗ Не соответствует</span>}
              </div>
              <div className="normative-formula">
                Формула: Капитал / Активы × 100%<br/>
                {formatNumber(latestData.capital)} / {formatNumber(latestData.assets)} × 100%
              </div>
            </div>

            <div className={`normative-card ${normatives.N1_1 >= data.metadata.normatives.N1_1_min ? 'compliant' : 'non-compliant'}`}>
              <div className="normative-header">
                <span className="normative-name">Н1.1</span>
                <span className="normative-type">Достаточность осн. капитала</span>
              </div>
              <div className="normative-value">{normatives.N1_1.toFixed(2)}%</div>
              <div className="normative-min">
                Мин.: {data.metadata.normatives.N1_1_min}%
                {normatives.N1_1 >= data.metadata.normatives.N1_1_min 
                  ? <span className="status-ok"> ✓ Соответствует</span>
                  : <span className="status-fail"> ✗ Не соответствует</span>}
              </div>
              <div className="normative-formula">
                Формула: Осн. капитал / Активы × 100%<br/>
                {formatNumber(latestData.core_capital)} / {formatNumber(latestData.assets)} × 100%
              </div>
            </div>

            <div className={`normative-card ${normatives.N1_2 >= data.metadata.normatives.N1_2_min ? 'compliant' : 'non-compliant'}`}>
              <div className="normative-header">
                <span className="normative-name">Н1.2</span>
                <span className="normative-type">Достаточность доп. капитала</span>
              </div>
              <div className="normative-value">{normatives.N1_2.toFixed(2)}%</div>
              <div className="normative-min">
                Мин.: {data.metadata.normatives.N1_2_min}%
                {normatives.N1_2 >= data.metadata.normatives.N1_2_min 
                  ? <span className="status-ok"> ✓ Соответствует</span>
                  : <span className="status-fail"> ✗ Не соответствует</span>}
              </div>
              <div className="normative-formula">
                Формула: Доп. капитал / Активы × 100%<br/>
                {formatNumber(latestData.additional_capital)} / {formatNumber(latestData.assets)} × 100%
              </div>
            </div>
          </div>
        </section>

        {/* Summary Cards */}
        <section className="summary-section">
          <h2>Сводные показатели ({formatDate(latestData.period)})</h2>
          <div className="cards-grid">
            <div className="card card-blue">
              <div className="card-label">Активы</div>
              <div className="card-value">{formatNumber(latestData.assets)}</div>
              <div className="card-unit">млрд руб</div>
            </div>
            <div className="card card-green">
              <div className="card-label">Капитал</div>
              <div className="card-value">{formatNumber(latestData.capital)}</div>
              <div className="card-unit">млрд руб</div>
            </div>
            <div className="card card-purple">
              <div className="card-label">Чистая прибыль</div>
              <div className="card-value">{formatNumber(latestData.profit)}</div>
              <div className="card-unit">млрд руб</div>
            </div>
            <div className="card card-orange">
              <div className="card-label">Кредитный портфель</div>
              <div className="card-value">{formatNumber(latestData.loan_portfolio)}</div>
              <div className="card-unit">млрд руб</div>
            </div>
            <div className="card card-red">
              <div className="card-label">Просрочка</div>
              <div className="card-value">{formatNumber(latestData.overdue)}</div>
              <div className="card-unit">млрд руб</div>
            </div>
            <div className="card card-teal">
              <div className="card-label">Вклады физлиц</div>
              <div className="card-value">{formatNumber(latestData.deposits_individuals)}</div>
              <div className="card-unit">млрд руб</div>
            </div>
          </div>
        </section>

        {/* Chart Section */}
        <section className="chart-section">
          <div className="chart-header">
            <h2>Динамика показателя</h2>
            <select 
              className="metric-select"
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value)}
            >
              {metrics.map(m => (
                <option key={m} value={m}>{getMetricLabel(m)}</option>
              ))}
            </select>
          </div>
          <div className="chart-container">
            <div className="chart">
              {chartData.map((d, i) => {
                const range = maxChartValue - minChartValue
                const height = range > 0 
                  ? ((d.value - minChartValue) / range) * 80 + 20 
                  : 50
                return (
                  <div key={i} className="chart-bar-wrapper">
                    <div className="chart-tooltip">
                      {d.value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
                    </div>
                    <div 
                      className={`chart-bar ${selectedMetric.startsWith('N1') ? 'bar-normative' : ''}`}
                      style={{ height: `${height}%` }}
                    ></div>
                    <div className="chart-label">{d.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="comparison-section">
          <h2>Сравнение нормативов (последний период)</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Банк</th>
                  <th>Активы, млрд ₽</th>
                  <th>Капитал, млрд ₽</th>
                  <th>Н1.0, %</th>
                  <th>Н1.1, %</th>
                  <th>Н1.2, %</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.banks.map(bank => {
                  const latest = bank.data[bank.data.length - 1]
                  const n = calculateNormatives(latest)
                  const isCompliant = n.N1_0 >= data.metadata.normatives.N1_0_min 
                    && n.N1_1 >= data.metadata.normatives.N1_1_min 
                    && n.N1_2 >= data.metadata.normatives.N1_2_min
                  return (
                    <tr key={bank.bank_id}>
                      <td className="bank-name-cell">{bank.name}</td>
                      <td className="number-cell">{formatNumber(latest.assets)}</td>
                      <td className="number-cell">{formatNumber(latest.capital)}</td>
                      <td className={`number-cell ${n.N1_0 >= data.metadata.normatives.N1_0_min ? 'value-ok' : 'value-fail'}`}>
                        {n.N1_0.toFixed(2)}%
                      </td>
                      <td className={`number-cell ${n.N1_1 >= data.metadata.normatives.N1_1_min ? 'value-ok' : 'value-fail'}`}>
                        {n.N1_1.toFixed(2)}%
                      </td>
                      <td className={`number-cell ${n.N1_2 >= data.metadata.normatives.N1_2_min ? 'value-ok' : 'value-fail'}`}>
                        {n.N1_2.toFixed(2)}%
                      </td>
                      <td className="status-cell">
                        {isCompliant 
                          ? <span className="status-badge status-ok-badge">✓ Норма</span>
                          : <span className="status-badge status-fail-badge">✗ Нарушение</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Table Section */}
        <section className="table-section">
          <div className="table-header">
            <h2>Таблица показателей — {currentBank.name}</h2>
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
                  <th onClick={() => handleSort('assets')} className="sortable">
                    Активы {sortField === 'assets' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('capital')} className="sortable">
                    Капитал {sortField === 'capital' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('N1_0')} className="sortable">
                    Н1.0, % {sortField === 'N1_0' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('N1_1')} className="sortable">
                    Н1.1, % {sortField === 'N1_1' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('N1_2')} className="sortable">
                    Н1.2, % {sortField === 'N1_2' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('profit')} className="sortable">
                    Прибыль {sortField === 'profit' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('loan_portfolio')} className="sortable">
                    Кред. портфель {sortField === 'loan_portfolio' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, i) => {
                  const n = calculateNormatives(row)
                  return (
                    <tr key={i}>
                      <td className="period-cell">{formatDate(row.period)}</td>
                      <td className="number-cell">{formatNumber(row.assets)}</td>
                      <td className="number-cell">{formatNumber(row.capital)}</td>
                      <td className={`number-cell ${n.N1_0 >= data.metadata.normatives.N1_0_min ? 'value-ok' : 'value-fail'}`}>
                        {n.N1_0.toFixed(2)}%
                      </td>
                      <td className={`number-cell ${n.N1_1 >= data.metadata.normatives.N1_1_min ? 'value-ok' : 'value-fail'}`}>
                        {n.N1_1.toFixed(2)}%
                      </td>
                      <td className={`number-cell ${n.N1_2 >= data.metadata.normatives.N1_2_min ? 'value-ok' : 'value-fail'}`}>
                        {n.N1_2.toFixed(2)}%
                      </td>
                      <td className="number-cell">{formatNumber(row.profit)}</td>
                      <td className="number-cell">{formatNumber(row.loan_portfolio)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Info Section */}
        <section className="info-section">
          <h2>Методология расчёта нормативов</h2>
          <div className="info-content">
            <p>
              <strong>Нормативы достаточности капитала</strong> рассчитываются в соответствии с:
            </p>
            <ul>
              <li>Положение ЦБ РФ № 646-П «О методике определения собственных средств (капитала) кредитных организаций»</li>
              <li>Положение ЦБ РФ № 2024-У «Об обязательных нормативах и надбавках к нормативам достаточности капитала банков с универсальной лицензией»</li>
              <li>Базель III (Basel III) — международные стандарты</li>
            </ul>
            
            <h3>Формулы расчёта:</h3>
            <div className="formula-block">
              <p><strong>Н1.0</strong> = К / А × 100% ≥ <strong>12.5%</strong> (для СЗКО)</p>
              <p><strong>Н1.1</strong> = К₁ / А × 100% ≥ <strong>9.0%</strong> (для СЗКО)</p>
              <p><strong>Н1.2</strong> = К₂ / А × 100% ≥ <strong>3.5%</strong> (для СЗКО)</p>
            </div>
            
            <p>Где:</p>
            <ul>
              <li>К — собственный капитал (основной + дополнительный)</li>
              <li>К₁ — основной капитал (Common Equity Tier 1)</li>
              <li>К₂ — дополнительный капитал (Tier 2)</li>
              <li>А — активы, взвешенные по уровню риска (RWA)</li>
            </ul>

            <p className="note">
              ⚠️ <strong>Примечание:</strong> В данной таблице используется упрощённый расчёт, 
              где в знаменателе применяются общие активы вместо активов, взвешенных по риску (RWA). 
              Для точных значений нормативов необходимо обратиться к официальной отчётности банков 
              на сайте <a href="https://www.cbr.ru" target="_blank" rel="noopener">ЦБ РФ</a>.
            </p>

            <h3>Перечень системно значимых кредитных организаций (СЗКО):</h3>
            <p>
              Утверждается Банком России. В перечень входят банки, оказывающие значительное влияние 
              на финансовую систему РФ. На 2025 год в перечень входят 13 банков.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Системно значимые банки РФ | Нормативы достаточности капитала | 2022–2026 | Источник: banki.ru / ЦБ РФ</p>
      </footer>
    </div>
  )
}

export default App
