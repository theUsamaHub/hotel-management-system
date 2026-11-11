import { useId, useState } from 'react';
const palette = [
  'var(--chart-1, #6d6ae8)',
  'var(--chart-2, #27958c)',
  'var(--chart-3, #d69b43)',
  'var(--chart-4, #cd6b8c)',
  'var(--chart-5, #7c91a4)',
];
const compact = (value) =>
  new globalThis.Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );

export function TrendChart({ title, description, rows, valueKey, previousKey, format, currency }) {
  const id = useId();
  const [active, setActive] = useState(null);
  const highest = Math.max(1, ...rows.flatMap((row) => [row[valueKey], row[previousKey]]));
  const max = currency ? highest : Math.ceil(highest / 4) * 4;
  const x = (index) => 64 + (index / Math.max(1, rows.length - 1)) * 570;
  const y = (value) => 220 - (value / max) * 170;
  const points = (key) => rows.map((row, index) => `${x(index)},${y(row[key])}`).join(' ');
  const nonempty = rows.some((row) => row[valueKey] || row[previousKey]);
  const selected = active == null ? null : rows[active];
  return (
    <section className="card analytics-panel trend-panel">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <div className="chart-legend">
        <span>
          <i />
          Current period
        </span>
        <span>
          <i className="previous" />
          Previous period
        </span>
      </div>
      <svg
        className="trend-svg"
        viewBox="0 0 660 260"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>
          {description} Exact daily values are available in the data table below.
        </desc>
        {[0, 1, 2, 3, 4].map((step) => (
          <g key={step}>
            <line
              x1="64"
              x2="634"
              y1={y((max * step) / 4)}
              y2={y((max * step) / 4)}
              className="chart-gridline"
            />
            <text x="54" y={y((max * step) / 4) + 4} textAnchor="end">
              {compact((max * step) / 4 / (currency ? 100 : 1))}
            </text>
          </g>
        ))}
        <polyline
          points={points(previousKey)}
          fill="none"
          stroke="var(--chart-previous, #8e9bad)"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
        <polyline
          points={points(valueKey)}
          fill="none"
          stroke="var(--chart-current, #7774ee)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {rows.map((row, index) => (
          <circle
            key={row.date}
            cx={x(index)}
            cy={y(row[valueKey])}
            r={active === index ? 6 : 3}
            fill="var(--chart-current, #7774ee)"
            tabIndex="0"
            aria-label={`${row.date}: ${format(row[valueKey])}; previous ${row.previousDate}: ${format(row[previousKey])}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
          >
            <title>
              {row.date}: {format(row[valueKey])}
            </title>
          </circle>
        ))}
        {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].map((index) => (
          <text
            key={index}
            x={x(index)}
            y="246"
            textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}
          >
            {rows[index].date.slice(5)}
          </text>
        ))}
      </svg>
      <div className="chart-readout" aria-live="polite">
        {selected ? (
          <>
            {selected.date}: <strong>{format(selected[valueKey])}</strong> · {selected.previousDate}
            : {format(selected[previousKey])}
          </>
        ) : nonempty ? (
          'Hover or focus a point for exact values.'
        ) : (
          'No recorded activity in either period.'
        )}
      </div>
      <details className="chart-data">
        <summary>View {title.toLowerCase()} data</summary>
        <div className="table-wrap">
          <table>
            <caption>
              {title} — exact values{currency ? ` (${currency})` : ''}
            </caption>
            <thead>
              <tr>
                <th>Current date</th>
                <th>Value</th>
                <th>Previous date</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{format(row[valueKey])}</td>
                  <td>{row.previousDate}</td>
                  <td>{format(row[previousKey])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function DistributionChart({ title, description, items, donut = false }) {
  const id = useId();
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 60;
  return (
    <section className="card analytics-panel">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <div className={donut ? 'distribution-layout' : ''}>
        {donut && (
          <svg viewBox="0 0 170 170" className="donut-svg" role="img" aria-labelledby={id}>
            <title id={id}>
              {title}: {items.map((item) => `${item.label} ${item.value}`).join(', ')}
            </title>
            <circle cx="85" cy="85" r="60" fill="none" stroke="var(--line)" strokeWidth="20" />
            {items.map((item, index) => (
              <circle
                key={item.label}
                cx="85"
                cy="85"
                r="60"
                fill="none"
                stroke={palette[index % palette.length]}
                strokeWidth="20"
                strokeDasharray={`${total ? (item.value / total) * circumference : 0} ${circumference}`}
                strokeDashoffset={
                  total
                    ? (-items.slice(0, index).reduce((sum, entry) => sum + entry.value, 0) /
                        total) *
                      circumference
                    : 0
                }
                transform="rotate(-90 85 85)"
              />
            ))}
            <text x="85" y="85" textAnchor="middle" className="donut-total">
              {total}
            </text>
            <text x="85" y="108" textAnchor="middle">
              bookings
            </text>
          </svg>
        )}
        <ul className="distribution-list">
          {items.map((item, index) => (
            <li key={item.label}>
              <div>
                <span>
                  <i style={{ background: palette[index % palette.length] }} />
                  {item.label}
                </span>
                <strong>
                  {item.value}{' '}
                  <small>({total ? ((item.value / total) * 100).toFixed(0) : 0}%)</small>
                </strong>
              </div>
              {!donut && (
                <div className="distribution-track">
                  <span
                    style={{
                      width: `${total ? (item.value / total) * 100 : 0}%`,
                      background: palette[index % palette.length],
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      {!total && <p className="muted">No records in this scope.</p>}
    </section>
  );
}
