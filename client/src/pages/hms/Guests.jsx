import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import Pagination from '../../components/Pagination.jsx';
import { get, useSave, Field, QueryContent } from './shared.jsx';

export default function Guests({ hotel, isGuest }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const query = useQuery({
    queryKey: ['hms', 'guests', hotel, page, search],
    queryFn: () => get('guests', { hotel, page, search, limit: 10 }),
  });
  const save = useSave(
    () =>
      editing
        ? api.put(`/hms/guests/${editing}`, form)
        : api.post('/hms/guests', { ...form, hotel }),
    () => setForm(null),
  );
  const change = (name, value) => setForm({ ...form, [name]: value });
  function edit(row) {
    setEditing(row?._id || null);
    setForm({
      name: row?.name || '',
      email: row?.email || '',
      phone: row?.phone || '',
      preferences: row?.preferences || '',
    });
  }
  return (
    <>
      <div className="toolbar">
        <h2>{isGuest ? 'My guest profile' : 'Guest profiles'}</h2>
        {(!isGuest || query.data?.pagination.total === 0) && (
          <button className="button" disabled={save.isPending} onClick={() => edit()}>
            Add guest profile
          </button>
        )}
      </div>
      <p className="muted">
        Contact details and preferences for this hotel. Changes apply to new bookings; existing
        bookings retain their original contact details.
      </p>
      {form && (
        <section className="card hms-form">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <fieldset className="hms-fields" disabled={save.isPending}>
              <Field
                label="Guest name"
                name="name"
                value={form.name}
                change={change}
                maxLength={80}
              />
              <Field
                label="Contact email"
                name="email"
                value={form.email}
                change={change}
                type="email"
                maxLength={254}
              />
              <Field
                label="Contact phone"
                name="phone"
                value={form.phone}
                change={change}
                type="tel"
                maxLength={30}
              />
              <Field
                label="Preferences"
                name="preferences"
                value={form.preferences}
                change={change}
                maxLength={1000}
                required={false}
              />
            </fieldset>
            <div className="toolbar">
              <button className="button" disabled={save.isPending}>
                Save profile
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={save.isPending}
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="card">
        {!isGuest && (
          <div className="toolbar">
            <input
              aria-label="Search guests"
              placeholder="Search guests…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
        <QueryContent query={query}>
          {(data) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Preferences</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.guests.map((row) => (
                      <tr key={row._id}>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>{row.phone}</td>
                        <td>{row.preferences || '—'}</td>
                        <td>
                          <button className="button secondary small" onClick={() => edit(row)}>
                            Edit profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.guests.length && (
                <p className="empty">Create a guest profile before booking a room.</p>
              )}
              <Pagination pagination={data.pagination} onPageChange={setPage} />
            </>
          )}
        </QueryContent>
      </section>
    </>
  );
}
