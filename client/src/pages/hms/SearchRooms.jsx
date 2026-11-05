import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import Pagination from '../../components/Pagination.jsx';
import { all, get, money, dateAfter, useSave, Field, QueryContent } from './shared.jsx';

export default function SearchRooms({ hotel, editing, done, profiles }) {
  const [form, setForm] = useState({
    checkIn: editing?.checkIn || dateAfter(1),
    checkOut: editing?.checkOut || dateAfter(2),
    occupants: editing?.occupants || 1,
  });
  const [criteria, setCriteria] = useState(null);
  const [page, setPage] = useState(1);
  const [guest, setGuest] = useState('');
  const [notes, setNotes] = useState(editing?.notes || '');
  const guests = useQuery({
    queryKey: ['hms', 'guest-options', hotel],
    enabled: !editing,
    queryFn: () => all('guests', 'guests', { hotel }),
  });
  const query = useQuery({
    queryKey: ['hms', 'availability', hotel, criteria, page, editing?._id],
    enabled: !!criteria,
    queryFn: () =>
      get('availability', {
        hotel,
        ...criteria,
        page,
        limit: 10,
        ...(editing ? { excludeReservation: editing._id } : {}),
      }),
  });
  const save = useSave((room) => {
    const payload = { room: room._id, ...criteria, occupants: Number(criteria.occupants), notes };
    return editing
      ? api.put(`/hms/reservations/${editing._id}`, { ...payload, version: editing.version })
      : api.post('/hms/reservations', { ...payload, hotel, guest: guest || guests.data?.[0]?._id });
  }, done);
  const change = (name, value) => {
    setForm({ ...form, [name]: value });
    setCriteria(null);
  };
  return (
    <>
      <h2>{editing ? 'Modify reservation / reassign room' : 'Find and reserve a room'}</h2>
      <p className="muted">
        Arrival is inclusive; departure is exclusive. Dates use UTC. Pending bookings hold the room
        until staff confirms or cancels them. Guest changes and cancellations are allowed through
        the arrival date, before check-in.
      </p>
      {editing && (
        <p>
          Current room: {editing.quote.roomNumber}. Keeping this room preserves its nightly rate;
          choosing another room uses its current rate.
        </p>
      )}
      <section className="card hms-form">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setCriteria({ ...form, occupants: Number(form.occupants) });
          }}
        >
          <fieldset className="hms-fields" disabled={save.isPending}>
            <Field
              label="Arrival"
              name="checkIn"
              value={form.checkIn}
              change={change}
              type="date"
              min={dateAfter(0)}
              max={dateAfter(730)}
            />
            <Field
              label="Departure"
              name="checkOut"
              value={form.checkOut}
              change={change}
              type="date"
              min={form.checkIn}
            />
            <Field
              label="Number of guests"
              name="occupants"
              value={form.occupants}
              change={change}
              type="number"
              min="1"
              max="20"
              step="1"
            />
          </fieldset>
          <button className="button" disabled={save.isPending}>
            Search availability
          </button>
          {editing && (
            <button
              type="button"
              className="button secondary"
              disabled={save.isPending}
              onClick={done}
            >
              Cancel changes
            </button>
          )}
        </form>
      </section>
      {!editing && (
        <section className="card hms-form">
          <QueryContent query={guests}>
            {(rows) =>
              rows.length ? (
                <Field
                  label="Guest profile"
                  name="guest"
                  value={guest || rows[0]._id}
                  change={(_name, value) => setGuest(value)}
                  options={rows.map((row) => [row._id, `${row.name} · ${row.email}`])}
                />
              ) : (
                <p>Create a guest profile to make a reservation.</p>
              )
            }
          </QueryContent>
          <button className="button secondary small" onClick={profiles}>
            Manage guest profiles
          </button>
        </section>
      )}
      <label className="hms-field">
        Booking notes
        <input value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {criteria && (
        <section className="card">
          <QueryContent query={query}>
            {(data) => (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Type / capacity</th>
                        <th>Nightly rate</th>
                        <th>Stay subtotal</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rooms.map((room) => {
                        const same = editing && editing.room === room._id;
                        const rate = same ? editing.quote.rate : room.roomType.rate;
                        const currency = same ? editing.quote.currency : room.roomType.currency;
                        const nights =
                          (Date.parse(criteria.checkOut) - Date.parse(criteria.checkIn)) / 86400000;
                        return (
                          <tr key={room._id}>
                            <td>{room.number}</td>
                            <td>
                              {room.roomType.name} / {room.roomType.capacity}
                            </td>
                            <td>{money(rate, currency)}</td>
                            <td>
                              {money(rate * nights, currency)} / {nights} nights
                            </td>
                            <td>
                              <button
                                className="button small"
                                disabled={save.isPending || (!editing && !guests.data?.length)}
                                onClick={() => save.mutate(room)}
                              >
                                {save.isPending
                                  ? 'Saving…'
                                  : editing
                                    ? 'Save reservation'
                                    : 'Reserve room'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!data.rooms.length && (
                  <p className="empty">No rooms match these dates and guest count.</p>
                )}
                <p className="muted hms-note">
                  Room charges only; taxes and additional services are not included. Availability is
                  checked again when saving.
                </p>
                <Pagination pagination={data.pagination} onPageChange={setPage} />
              </>
            )}
          </QueryContent>
        </section>
      )}
    </>
  );
}
