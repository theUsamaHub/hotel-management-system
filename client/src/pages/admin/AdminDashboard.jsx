import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  BedDouble,
  ReceiptText,
  Wallet,
  Star,
  Users,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api/axios.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { TrendChart, DistributionChart } from '../../components/DashboardCharts.jsx';

export const formatMoney = (amount, currency) =>
  new globalThis.Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
function Change({ metric }) {
  if (metric.percent == null)
    return (
      <span className="metric-change neutral">
        {metric.current ? 'No previous activity' : 'No activity in either period'}
      </span>
    );
  return (
    <span
      className={`metric-change ${metric.change > 0 ? 'positive' : metric.change < 0 ? 'negative' : 'neutral'}`}
    >
      {metric.change > 0 ? '+' : ''}
      {metric.percent.toFixed(1)}% vs previous period
    </span>
  );
}
function Metric({ label, value, detail, icon: Icon, metric }) {
  return (
    <article className="card analytics-metric">
      <div className="metric-label">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      {metric && <Change metric={metric} />}
      <small>{detail}</small>
    </article>
  );
}
const roomLabels = {
  available: 'Ready / available',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
};
const bookingLabels = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
};

export default function AdminDashboard() {
  const [hotel, setHotel] = useState('');
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState('PKR');
  const query = useQuery({
    queryKey: ['admin-dashboard', hotel, days, currency],
    queryFn: async ({ signal }) =>
      (
        await api.get('/admin/dashboard', {
          params: { days, currency, ...(hotel ? { hotel } : {}) },
          signal,
        })
      ).data.dashboard,
    placeholderData: keepPreviousData,
    retry: 1,
  });
  const data = query.data;
  const money = (value) => formatMoney(value, currency);
  return (
    <div className="analytics-dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Luxury Star Hotel / Performance overview</p>
          <h1>Hotel dashboard</h1>
          <p>Your properties, performance and priorities in one place.</p>
        </div>
        <Link className="button" to="/admin/operations">
          Hotel operations <ArrowUpRight size={17} />
        </Link>
      </div>
      <section className="card analytics-filters" aria-label="Dashboard filters">
        <label>
          Hotel property
          <select
            value={hotel}
            onChange={(e) => setHotel(e.target.value)}
            aria-label="Hotel property"
          >
            <option value="">All properties</option>
            {data?.hotels.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
                {item.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reporting period
          <select
            aria-label="Reporting period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 30, 90].map((value) => (
              <option key={value} value={value}>
                Last {value} days
              </option>
            ))}
          </select>
        </label>
        <label>
          Financial currency
          <select
            aria-label="Financial currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {['PKR', 'USD', 'EUR', 'GBP', 'AED'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw size={16} />
          {query.isFetching ? 'Updating…' : 'Refresh data'}
        </button>
      </section>
      {query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.isPending || query.isPlaceholderData ? (
        <Loader />
      ) : (
        <>
          <p className="analytics-period">
            {data.period.from} – {data.daily.at(-1).date} · Compared with {data.period.previousFrom}{' '}
            – {data.daily.at(-1).previousDate} · UTC calendar dates. Today is incomplete.{' '}
            <span>Updated {new Date(data.generatedAt).toLocaleTimeString()}</span>
          </p>
          <div className="analytics-metrics">
            <Metric
              label="Payments recorded"
              value={money(data.totals.payments.current)}
              detail={`External receipts in ${currency}; not online charges`}
              metric={data.totals.payments}
              icon={Wallet}
            />
            <Metric
              label="Issued invoice total"
              value={money(data.totals.invoices.current)}
              detail="Final invoices, including tax; drafts excluded"
              metric={data.totals.invoices}
              icon={ReceiptText}
            />
            <Metric
              label="New reservations"
              value={data.totals.bookings.current.toLocaleString()}
              detail="Created in this period, including later cancellations"
              metric={data.totals.bookings}
              icon={CalendarDays}
            />
            <Metric
              label="Current occupancy"
              value={
                data.inventory.occupancyPercent == null
                  ? 'N/A'
                  : `${data.inventory.occupancyPercent.toFixed(1)}%`
              }
              detail={`${data.inventory.occupied} of ${data.inventory.total} active rooms occupied now`}
              icon={BedDouble}
            />
            <Metric
              label="Active properties"
              value={data.properties.active}
              detail={`${data.properties.total} properties in the selected scope`}
              icon={Building2}
            />
            <Metric
              label="Active hotel staff"
              value={data.staff}
              detail="Managers, reception, housekeeping and maintenance"
              icon={Users}
            />
            <Metric
              label="Guest rating"
              value={
                data.feedback.average == null
                  ? 'No reviews'
                  : `${data.feedback.average.toFixed(1)} / 5`
              }
              detail={`${data.feedback.count} reviews submitted in this period`}
              icon={Star}
            />
            <Metric
              label="Rooms with a repair block"
              value={data.inventory.blocked}
              detail="Current active inventory; may include occupied rooms"
              icon={BedDouble}
            />
          </div>
          <div className="analytics-chart-grid">
            <TrendChart
              title="Payment trend"
              description={`Recorded receipts in ${currency}. Previous period is aligned by day number.`}
              rows={data.daily}
              valueKey="payments"
              previousKey="previousPayments"
              format={money}
              currency={currency}
            />
            <TrendChart
              title="Booking growth"
              description="Reservations created each day, across all currencies. Not scheduled arrivals."
              rows={data.daily}
              valueKey="bookings"
              previousKey="previousBookings"
              format={(value) => value.toLocaleString()}
            />
            <TrendChart
              title="Invoice trend"
              description={`Final invoice totals in ${currency}, by issue date. Do not add these to payments.`}
              rows={data.daily}
              valueKey="invoices"
              previousKey="previousInvoices"
              format={money}
              currency={currency}
            />
            <DistributionChart
              title="Reservation mix"
              description="Current status of bookings created in the selected period."
              items={Object.entries(bookingLabels).map(([key, label]) => ({
                label,
                value: data.bookingStates.find((item) => item._id === key)?.count || 0,
              }))}
              donut
            />
          </div>
          <div className="analytics-bottom-grid">
            <DistributionChart
              title="Rooms right now"
              description="Active rooms and room types at active properties. Physical status is not date availability."
              items={Object.entries(roomLabels).map(([key, label]) => ({
                label,
                value: data.roomStates.find((item) => item._id === key)?.count || 0,
              }))}
            />
            <section className="card analytics-panel">
              <div className="section-label">
                <h2>Today’s desk</h2>
                <span className="badge">UTC</span>
              </div>
              <div className="desk-grid">
                {[
                  ['Arrivals due', data.queues.arrivals],
                  ['Departures due', data.queues.departures],
                  ['Overdue stays', data.queues.overdue],
                  ['Awaiting confirmation', data.queues.pendingBookings],
                ].map(([label, value]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="muted">
                Arrivals are confirmed bookings due today. Departures are checked-in bookings due
                today; overdue stays are shown separately. Pending bookings include all dates.
              </p>
              <Link className="analytics-link" to="/admin/operations">
                Open reservations <ArrowUpRight size={16} />
              </Link>
            </section>
            <section className="card analytics-panel">
              <h2>Work requiring attention</h2>
              <p className="muted">
                Open work across the selected hotel scope, regardless of reporting period.
              </p>
              {[
                ['Cleaning tasks', data.queues.cleaning],
                ['Maintenance issues', data.queues.maintenance],
                ['Service requests', data.queues.services],
              ].map(([label, value]) => (
                <div className="queue-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
              <Link className="analytics-link" to="/admin/operations">
                Manage hotel work <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>
          <section className="card analytics-panel">
            <div className="section-label">
              <div>
                <h2>Next confirmed arrivals</h2>
                <p className="muted">
                  The next six bookings from today, across the selected scope.
                </p>
              </div>
              <Link to="/admin/operations" className="analytics-link">
                View bookings <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Guest / booking reference</th>
                    <th>Property</th>
                    <th>Room</th>
                    <th>Arrival</th>
                    <th>Departure</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming.map((booking) => (
                    <tr key={booking._id}>
                      <td>
                        <strong>{booking.contact?.name || 'Guest'}</strong>
                        <small className="audit-id">{booking.reference}</small>
                      </td>
                      <td>{booking.hotel?.name || 'Archived property'}</td>
                      <td>{booking.quote?.roomNumber || '—'}</td>
                      <td>{booking.checkIn}</td>
                      <td>{booking.checkOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.upcoming.length && (
              <p className="empty">
                No upcoming confirmed arrivals. Pending bookings appear in Today’s desk.
              </p>
            )}
          </section>
          <details className="analytics-definitions">
            <summary>How these numbers are calculated</summary>
            <p>
              All charts use UTC dates and include today so far. Comparisons use the immediately
              preceding {days} calendar days; that period is complete, while today is still
              changing. Percentage change is unavailable when the previous total is zero. Empty
              dates are shown as zero recorded activity; missing or unimported history is not
              reconstructed.
            </p>
            <p>
              Only financial cards and charts use the currency filter. Payments use receipt creation
              dates. Issued invoice totals include tax and use issue dates; they are not profit and
              are never added to payments. Reservation counts use creation dates and include
              cancelled bookings. Occupancy, staff, properties and work queues are current
              snapshots, so no historical growth is claimed for them.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
