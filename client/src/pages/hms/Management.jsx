import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import { get, Field, QueryContent, useSave, money, dateAfter } from './shared.jsx';
import Pagination from '../../components/Pagination.jsx';
const fields = [
  ['maxAdvanceDays', 'Advance booking limit (days)', 0, 730],
  ['maxStayNights', 'Maximum stay (nights)', 1, 365],
  ['cancellationDays', 'Cancel at least this many days before arrival', 0, 365],
  ['checkInHour', 'Check-in hour (UTC, 0-23)', 0, 23],
  ['checkOutHour', 'Checkout hour (UTC, 0-23)', 0, 23],
  ['weekendRateBps', 'Weekend arrival rate (10000 = 100%)', 1000, 30000],
  ['taxBps', 'Default tax (basis points; 100 = 1%)', 0, 10000],
];
function PolicyForm({ hotel, policy, close, global }) {
  const [form, setForm] = useState(policy);
  const save = useSave(
    () =>
      api.put(global ? '/hms/settings' : '/hms/policies', {
        ...form,
        ...(global ? {} : { hotel }),
      }),
    close,
  );
  return (
    <form
      className="hms-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {fields.map(([name, label, min, max]) => (
        <Field
          key={name}
          {...{ name, label, min, max }}
          type="number"
          value={form[name]}
          change={(key, value) => setForm({ ...form, [key]: Number(value) })}
        />
      ))}
      <label>
        <input
          type="checkbox"
          checked={form.allowSameDay}
          onChange={(e) => setForm({ ...form, allowSameDay: e.target.checked })}
        />{' '}
        Allow same-day arrivals
      </label>
      <p>
        Changes apply to new reservations. Existing reservations retain their saved policy and tax.
        All date rules use UTC calendar days.
      </p>
      <button className="button" disabled={save.isPending}>
        Save policy
      </button>
      <button className="button secondary" type="button" onClick={close}>
        Cancel
      </button>
    </form>
  );
}
export function Policies({ hotel, canManage, global = false }) {
  const [editing, setEditing] = useState(null);
  const reset = useSave((version) => api.post('/hms/policies/reset', { hotel, version }));
  const query = useQuery({
    queryKey: ['hms', 'policies', hotel, global],
    queryFn: () => get(global ? 'settings' : 'policies', global ? {} : { hotel }),
  });
  return (
    <section className="card hms-form">
      <h2>{global ? 'Global policy defaults' : 'Hotel policies'}</h2>
      <QueryContent query={query}>
        {({ policy, source }) => (
          <>
            <p>
              {global
                ? 'Used by hotels without a saved override.'
                : source === 'global'
                  ? 'Using global defaults. Saving creates a hotel-specific override.'
                  : 'Hotel-specific policy.'}
            </p>
            {fields.map(([name, label]) => (
              <p key={name}>
                {label}: <strong>{policy[name]}</strong>
              </p>
            ))}
            <p>
              Same-day arrivals: {policy.allowSameDay ? 'Allowed' : 'Not allowed'}. Cancellation
              deadlines use UTC dates; reception can assist after the deadline.
            </p>
            <p>
              Check-in is available on the arrival date through the day before departure. Early
              departure does not reduce room charges. Each full 24 hours after the saved checkout
              time adds one overdue night at the booked rate. Saturday/Sunday arrivals use the
              weekend rate for the whole booking; same-room changes retain the booked rate.
            </p>
            {canManage && !global && source === 'hotel' && !editing && (
              <button
                className="button secondary"
                disabled={reset.isPending}
                onClick={() => reset.mutate(policy.version)}
              >
                Use global defaults
              </button>
            )}
            {canManage && !editing && (
              <button className="button" onClick={() => setEditing({ ...policy })}>
                Edit policy
              </button>
            )}
            {editing && (
              <PolicyForm
                global={global}
                hotel={hotel}
                policy={editing}
                close={() => setEditing(null)}
              />
            )}
          </>
        )}
      </QueryContent>
    </section>
  );
}
export function Notifications({ hotel, openModule }) {
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const query = useQuery({
    queryKey: ['hms', 'notifications', hotel, page, unread],
    queryFn: () => get('notifications', { hotel, page, limit: 10, unread: String(unread) }),
    refetchInterval: 30000,
  });
  const read = useSave((id) => api.post(`/hms/notifications/${id}/read`, {}));
  return (
    <section className="card hms-form">
      <h2>My notifications</h2>
      <label>
        <input
          type="checkbox"
          checked={unread}
          onChange={(e) => {
            setUnread(e.target.checked);
            setPage(1);
          }}
        />{' '}
        Unread only
      </label>
      <QueryContent query={query}>
        {({ notifications, pagination }) => (
          <>
            {!notifications.length && <p>No notifications.</p>}
            {notifications.map((row) => (
              <article key={row._id}>
                <p>{row.message}</p>
                {openModule && (
                  <button className="button secondary" onClick={() => openModule(row.module)}>
                    Open module
                  </button>
                )}
                <small>
                  {row.module} · {new Date(row.createdAt).toLocaleString()}
                </small>
                {row.readAt ? (
                  <p>Read</p>
                ) : (
                  <button
                    className="button secondary"
                    disabled={read.isPending}
                    onClick={() => read.mutate(row._id)}
                  >
                    Mark read
                  </button>
                )}
              </article>
            ))}
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </QueryContent>
    </section>
  );
}
export function Reports({ hotel }) {
  const [dates, setDates] = useState({ from: dateAfter(-30), to: dateAfter(1) });
  const [range, setRange] = useState(dates);
  const query = useQuery({
    queryKey: ['hms', 'reports', hotel, range],
    queryFn: () => get('reports', { hotel, ...range }),
  });
  return (
    <section className="card hms-form">
      <h2>Management reports</h2>
      <form
        className="hms-form"
        onSubmit={(e) => {
          e.preventDefault();
          setRange({ ...dates });
        }}
      >
        <Field
          label="From (inclusive)"
          name="from"
          type="date"
          value={dates.from}
          change={(k, v) => setDates({ ...dates, [k]: v })}
        />
        <Field
          label="To (exclusive)"
          name="to"
          type="date"
          value={dates.to}
          change={(k, v) => setDates({ ...dates, [k]: v })}
        />
        <button className="button">Run report</button>
      </form>
      <p>
        UTC dates, maximum 366 days. Reservation counts use arrival dates and current status.
        Payments use receipt dates; issued invoices use issue dates. Different currencies are never
        combined.
      </p>
      <QueryContent query={query}>
        {({ report }) => (
          <>
            <h3>Reservations by status</h3>
            {report.reservations.length ? (
              report.reservations.map((r) => (
                <p key={r._id}>
                  {r._id.replaceAll('_', ' ')}: {r.count}
                </p>
              ))
            ) : (
              <p>No arrivals in this period.</p>
            )}
            <h3>Payments recorded</h3>
            {report.payments.length ? (
              report.payments.map((r) => (
                <p key={r._id}>
                  {money(r.amount, r._id)} · {r.count} payments
                </p>
              ))
            ) : (
              <p>No payments recorded.</p>
            )}
            <h3>Issued invoices</h3>
            {report.invoices.length ? (
              report.invoices.map((r) => (
                <p key={r._id}>
                  {r.count} invoices · Subtotal {money(r.subtotal, r._id)} · Discounts{' '}
                  {money(r.discount, r._id)} · Tax {money(r.tax, r._id)} · Total{' '}
                  {money(r.total, r._id)}
                </p>
              ))
            ) : (
              <p>No invoices issued.</p>
            )}
            <h3>Room operations</h3>
            <p>
              {report.occupiedRoomNights} occupied room-nights in this period (actual stays; current
              day is provisional).
            </p>
            <p>
              Current active rooms: {report.inventory.activeRooms} - Occupied now:{' '}
              {report.inventory.occupiedNow} - Current occupancy:{' '}
              {report.inventory.occupancyPercentNow == null
                ? 'N/A'
                : `${report.inventory.occupancyPercentNow.toFixed(1)}%`}
            </p>
            <p>
              Rooms available for the entire selected period:{' '}
              {report.inventory.availableForEntirePeriod ??
                'Historical availability is not reconstructed'}
            </p>
            <h3>Daily demand and feedback</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Arrivals</th>
                    <th>Cancelled</th>
                    <th>Occupied rooms</th>
                    <th>Reviews</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((r) => (
                    <tr key={r.date}>
                      <td>{r.date}</td>
                      <td>{r.arrivals}</td>
                      <td>{r.cancelled}</td>
                      <td>{r.occupiedRooms}</td>
                      <td>{r.reviews}</td>
                      <td>{r.rating?.toFixed(2) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Demand estimate and pricing guidance</h3>
            <p>
              Same-weekday average of the preceding 28 days of recorded stays, capped by current
              room inventory. Missing history counts as zero;{' '}
              {report.forecastHistory.observedRoomNights} observed room-nights. These estimates are
              not guarantees. Rate suggestions require manager review and never change prices
              automatically.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Estimated occupied rooms</th>
                    <th>Suggested rate vs base</th>
                  </tr>
                </thead>
                <tbody>
                  {report.forecast.map((r) => (
                    <tr key={r.date}>
                      <td>{r.date}</td>
                      <td>{r.expectedRooms ?? 'Insufficient history'}</td>
                      <td>
                        {r.suggestedRateBps == null
                          ? 'Insufficient history'
                          : `${r.suggestedRateBps / 100}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Guest feedback</h3>
            <p>
              {report.feedback.count} reviews · Average rating:{' '}
              {report.feedback.average == null
                ? 'No ratings'
                : `${report.feedback.average.toFixed(2)} / 5`}
            </p>
          </>
        )}
      </QueryContent>
    </section>
  );
}
export function Monitoring() {
  const query = useQuery({
    queryKey: ['hms', 'monitoring'],
    queryFn: () => get('monitoring'),
    refetchInterval: 30000,
  });
  return (
    <section className="card hms-form">
      <h2>Application monitoring</h2>
      <p>
        Measurements cover this API process since its last restart. They are not a fleet-wide uptime
        or load-test result. Refreshes every 30 seconds.
      </p>
      <QueryContent query={query}>
        {({ metrics }) => (
          <>
            <p>
              Started: {new Date(metrics.startedAt).toLocaleString()} · Uptime:{' '}
              {metrics.uptimeSeconds} seconds
            </p>
            <p>
              Requests: {metrics.requests} · Server errors: {metrics.serverErrors} · Requests over 2
              seconds: {metrics.slowRequests}
            </p>
            <p>
              Average response: {metrics.averageMs.toFixed(1)} ms · Maximum:{' '}
              {metrics.maximumMs.toFixed(1)} ms
            </p>
            <p>Process memory: {(metrics.memoryRssBytes / 1048576).toFixed(1)} MB</p>
          </>
        )}
      </QueryContent>
    </section>
  );
}
