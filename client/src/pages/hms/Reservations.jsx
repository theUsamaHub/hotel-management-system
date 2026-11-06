import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import Pagination from '../../components/Pagination.jsx';
import { get, money, dateAfter, useSave, Field, History, QueryContent } from './shared.jsx';
import { CheckInForm } from './Stays.jsx';

export default function Reservations({ hotel, isGuest, edit }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });
  const [cancel, setCancel] = useState(null);
  const [history, setHistory] = useState(null);
  const [arrival, setArrival] = useState(null);
  const query = useQuery({
    queryKey: ['hms', 'reservations', hotel, page, filters],
    queryFn: () =>
      get('reservations', {
        hotel,
        page,
        limit: 10,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      }),
  });
  const save = useSave(
    ({ row, action, reason = '' }) =>
      api.post(`/hms/reservations/${row._id}/${action}`, { version: row.version, reason }),
    () => setCancel(null),
  );
  const change = (name, value) => {
    setFilters({ ...filters, [name]: value });
    setPage(1);
  };
  return (
    <>
      <h2>{isGuest ? 'My reservations' : 'Reservations'}</h2>
      <div className="hms-fields">
        <Field
          label="Search bookings"
          name="search"
          value={filters.search}
          change={change}
          required={false}
          maxLength={100}
        />
        <Field
          label="Booking status"
          name="status"
          value={filters.status}
          change={change}
          required={false}
          options={[
            ['', 'All statuses'],
            ...['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].map((v) => [
              v,
              v.replaceAll('_', ' '),
            ]),
          ]}
        />
        <Field
          label="Arrival from"
          name="from"
          value={filters.from}
          change={change}
          required={false}
          type="date"
        />
        <Field
          label="Arrival through"
          name="to"
          value={filters.to}
          change={change}
          required={false}
          type="date"
        />
      </div>
      {cancel && (
        <section className="card hms-form">
          <h3>Cancel reservation for {cancel.row.contact.name}</h3>
          <p>
            {cancel.row.checkIn} → {cancel.row.checkOut}, room {cancel.row.quote.roomNumber}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ row: cancel.row, action: 'cancel', reason: cancel.reason });
            }}
          >
            <Field
              label="Cancellation reason"
              name="reason"
              value={cancel.reason}
              change={(_name, value) => setCancel({ ...cancel, reason: value })}
              required={false}
              maxLength={300}
            />
            <div className="toolbar">
              <button className="button" disabled={save.isPending}>
                Confirm cancellation
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={save.isPending}
                onClick={() => setCancel(null)}
              >
                Keep reservation
              </button>
            </div>
          </form>
        </section>
      )}
      {arrival && (
        <CheckInForm key={arrival._id} booking={arrival} close={() => setArrival(null)} />
      )}
      {history && (
        <History
          key={history}
          path={`reservations/${history}/history`}
          close={() => setHistory(null)}
        />
      )}
      <section className="card">
        <QueryContent query={query}>
          {(data) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Guest / reference</th>
                      <th>Room / dates</th>
                      <th>Subtotal</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reservations.map((row) => {
                      const active = ['pending', 'confirmed'].includes(row.status);
                      const upcoming = row.checkIn >= dateAfter(0);
                      return (
                        <tr key={row._id}>
                          <td>
                            {row.contact.name}
                            <small className="hms-reference">{row.reference}</small>
                            <small>{row.contact.email}</small>
                            {row.notes && <p>{row.notes}</p>}
                            {row.cancellationReason && (
                              <p>Cancellation: {row.cancellationReason}</p>
                            )}
                          </td>
                          <td>
                            {row.quote.roomNumber} / {row.occupants} guests
                            <br />
                            {row.checkIn} → {row.checkOut}
                          </td>
                          <td>
                            {money(row.quote.total, row.quote.currency)}
                            <br />
                            <small>
                              Tax: {(row.policy?.taxBps || 0) / 100}% - Cancel{' '}
                              {row.policy?.cancellationDays || 0} days before arrival - Check-in{' '}
                              {row.policy?.checkInHour || 0}:00 UTC
                            </small>
                          </td>
                          <td>{row.status.replaceAll('_', ' ')}</td>
                          <td>
                            <div className="hms-actions">
                              {!isGuest && row.status === 'pending' && upcoming && (
                                <button
                                  className="button small"
                                  disabled={save.isPending}
                                  onClick={() => save.mutate({ row, action: 'confirm' })}
                                >
                                  Confirm
                                </button>
                              )}
                              {active && upcoming && (
                                <button
                                  className="button secondary small"
                                  disabled={save.isPending}
                                  onClick={() => edit(row)}
                                >
                                  Modify / assign room
                                </button>
                              )}
                              {active && (!isGuest || upcoming) && (
                                <button
                                  className="button secondary small"
                                  disabled={save.isPending}
                                  onClick={() => setCancel({ row, reason: '' })}
                                >
                                  Cancel booking
                                </button>
                              )}
                              {!isGuest &&
                                row.status === 'confirmed' &&
                                row.checkIn <= dateAfter(0) &&
                                row.checkOut > dateAfter(0) && (
                                  <button className="button small" onClick={() => setArrival(row)}>
                                    Check in
                                  </button>
                                )}
                              <button
                                className="button secondary small"
                                onClick={() => setHistory(row._id)}
                              >
                                History
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!data.reservations.length && <p className="empty">No reservations found.</p>}
              <Pagination pagination={data.pagination} onPageChange={setPage} />
            </>
          )}
        </QueryContent>
      </section>
    </>
  );
}
