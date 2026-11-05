import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import Pagination from '../../components/Pagination.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { all, get, money, useSave, Field, History, QueryContent } from './shared.jsx';

export default function Inventory({ hotel, types = false, role }) {
  const resource = types ? 'room-types' : 'rooms';
  const key = types ? 'roomTypes' : 'rooms';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [statusForm, setStatusForm] = useState(null);
  const [history, setHistory] = useState(null);
  const canManage = ['admin', 'manager'].includes(role);
  const canStatus = ['admin', 'manager', 'housekeeping', 'maintenance'].includes(role);
  const query = useQuery({
    queryKey: ['hms', resource, hotel, page, search],
    queryFn: () => get(resource, { hotel, page, search, limit: 10 }),
  });
  const choices = useQuery({
    queryKey: ['hms', 'type-options', hotel],
    enabled: !types && canManage,
    queryFn: () => all('room-types', 'roomTypes', { hotel }),
  });
  const save = useSave(
    async () => {
      const payload = types
        ? {
            ...form,
            rate: Math.round(Number(form.price) * 100),
            capacity: Number(form.capacity),
            isActive: form.isActive === 'true',
          }
        : { ...form, isActive: form.isActive === 'true' };
      delete payload.price;
      return editing
        ? api.put(`/hms/${resource}/${editing}`, payload)
        : api.post(`/hms/${resource}`, { ...payload, hotel });
    },
    () => setForm(null),
  );
  const statusSave = useSave(
    () =>
      api.patch(`/hms/rooms/${statusForm.id}/status`, {
        status: statusForm.status,
        reason: statusForm.reason,
      }),
    () => setStatusForm(null),
  );
  const change = (name, value) => setForm({ ...form, [name]: value });
  function edit(row) {
    setEditing(row?._id || null);
    setForm(
      types
        ? {
            name: row?.name || '',
            description: row?.description || '',
            capacity: row?.capacity || 2,
            price: row ? row.rate / 100 : '',
            currency: row?.currency || 'PKR',
            isActive: String(row?.isActive ?? true),
          }
        : {
            number: row?.number || '',
            floor: row?.floor || '',
            roomType: row?.roomType?._id || '',
            isActive: String(row?.isActive ?? true),
          },
    );
  }
  return (
    <>
      <div className="toolbar">
        <h2>{types ? 'Room types & rates' : 'Room inventory'}</h2>
        {canManage && (
          <button className="button" disabled={save.isPending} onClick={() => edit()}>
            Add {types ? 'room type' : 'room'}
          </button>
        )}
      </div>
      {form && (
        <section className="card hms-form">
          <h3>
            {editing ? 'Edit' : 'Add'} {types ? 'room type' : 'room'}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <fieldset className="hms-fields" disabled={save.isPending}>
              {types ? (
                <>
                  <Field
                    label="Type name"
                    name="name"
                    value={form.name}
                    change={change}
                    maxLength={80}
                  />
                  <Field
                    label="Description"
                    name="description"
                    value={form.description}
                    change={change}
                    maxLength={1000}
                    required={false}
                  />
                  <Field
                    label="Maximum guests"
                    name="capacity"
                    value={form.capacity}
                    change={change}
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                  />
                  <Field
                    label="Nightly price"
                    name="price"
                    value={form.price}
                    change={change}
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                  />
                  <Field
                    label="Currency"
                    name="currency"
                    value={form.currency}
                    change={change}
                    options={['PKR', 'USD', 'EUR', 'GBP', 'AED'].map((v) => [v, v])}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Room number"
                    name="number"
                    value={form.number}
                    change={change}
                    maxLength={20}
                  />
                  <Field
                    label="Floor"
                    name="floor"
                    value={form.floor}
                    change={change}
                    maxLength={30}
                    required={false}
                  />
                  <Field
                    label="Room type"
                    name="roomType"
                    value={form.roomType}
                    change={change}
                    options={[
                      ['', 'Choose room type'],
                      ...(choices.data || [])
                        .filter((type) => type.isActive || type._id === form.roomType)
                        .map((type) => [
                          type._id,
                          `${type.name}${type.isActive ? '' : ' (inactive)'}`,
                        ]),
                    ]}
                  />
                  {choices.isError && <ErrorState error={choices.error} retry={choices.refetch} />}
                </>
              )}
              <Field
                label="Inventory status"
                name="isActive"
                value={form.isActive}
                change={change}
                options={[
                  ['true', 'Active'],
                  ['false', 'Inactive'],
                ]}
              />
            </fieldset>
            <div className="toolbar">
              <button className="button" disabled={save.isPending || (!types && !choices.data)}>
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setForm(null)}
                disabled={save.isPending}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {statusForm && (
        <section className="card hms-form">
          <h3>Change room {statusForm.number} status</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              statusSave.mutate();
            }}
          >
            <fieldset className="hms-fields" disabled={statusSave.isPending}>
              <Field
                label="Physical status"
                name="status"
                value={statusForm.status}
                change={(name, value) => setStatusForm({ ...statusForm, [name]: value })}
                options={statusForm.options.map((v) => [v, v])}
              />
              <Field
                label="Reason / completion details"
                name="reason"
                value={statusForm.reason}
                change={(name, value) => setStatusForm({ ...statusForm, [name]: value })}
                maxLength={300}
              />
            </fieldset>
            <div className="toolbar">
              <button className="button" disabled={statusSave.isPending}>
                Save status
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={statusSave.isPending}
                onClick={() => setStatusForm(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {history && (
        <History key={history} path={`rooms/${history}/history`} close={() => setHistory(null)} />
      )}
      <section className="card">
        <div className="toolbar">
          <input
            aria-label={`Search ${resource}`}
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <QueryContent query={query}>
          {(data) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{types ? 'Type' : 'Room'}</th>
                      <th>{types ? 'Capacity' : 'Type / floor'}</th>
                      <th>{types ? 'Nightly price' : 'Physical status'}</th>
                      <th>Inventory</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data[key].map((row) => {
                      const transitions =
                        row.status === 'occupied'
                          ? []
                          : row.status === 'maintenance'
                            ? ['cleaning']
                            : row.status === 'cleaning'
                              ? ['available', 'maintenance']
                              : ['cleaning', 'maintenance'];
                      const allowed =
                        role === 'housekeeping'
                          ? row.status === 'cleaning'
                            ? ['available']
                            : []
                          : role === 'maintenance'
                            ? row.status === 'maintenance'
                              ? ['cleaning']
                              : []
                            : transitions;
                      return (
                        <tr key={row._id}>
                          <td>{types ? row.name : row.number}</td>
                          <td>
                            {types
                              ? row.capacity
                              : `${row.roomType?.name || 'Unknown'} / ${row.floor || '—'}`}
                          </td>
                          <td>{types ? money(row.rate, row.currency) : row.status}</td>
                          <td>{row.isActive ? 'Active' : 'Inactive'}</td>
                          <td>
                            <div className="hms-actions">
                              {canManage && (
                                <button
                                  className="button secondary small"
                                  onClick={() => edit(row)}
                                >
                                  Edit
                                </button>
                              )}
                              {!types && canStatus && allowed.length > 0 && (
                                <button
                                  className="button secondary small"
                                  onClick={() =>
                                    setStatusForm({
                                      id: row._id,
                                      number: row.number,
                                      status: allowed[0],
                                      options: allowed,
                                      reason: '',
                                    })
                                  }
                                >
                                  Change status
                                </button>
                              )}
                              {!types && (
                                <button
                                  className="button secondary small"
                                  onClick={() => setHistory(row._id)}
                                >
                                  History
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data[key].length === 0 && (
                <p className="empty">No {types ? 'room types' : 'rooms'} found.</p>
              )}
              <Pagination pagination={data.pagination} onPageChange={setPage} />
            </>
          )}
        </QueryContent>
      </section>
    </>
  );
}
