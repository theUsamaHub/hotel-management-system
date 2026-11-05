import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import useAuth from '../../hooks/useAuth.js';
import Pagination from '../../components/Pagination.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { all, get, Field, History, QueryContent, useSave } from './shared.jsx';

const localTime = (value = new Date()) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
function CleaningQueue({ hotel }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['hms', 'cleaning-queue', hotel, page],
    queryFn: () => get('housekeeping/queue', { hotel, page, limit: 10 }),
  });
  return (
    <section className="card hms-form">
      <h3>Rooms awaiting cleaning</h3>
      <QueryContent query={query}>
        {(data) => (
          <>
            <p>
              {data.rooms.map((room) => room.number).join(', ') ||
                'No rooms are currently awaiting cleaning.'}
            </p>
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </QueryContent>
    </section>
  );
}
function AffectedBookings({ id, close }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['hms', 'affected', id, page],
    queryFn: () => get(`maintenance/${id}/affected`, { page, limit: 10 }),
  });
  return (
    <section className="card hms-form">
      <div className="toolbar">
        <h3>Bookings needing attention</h3>
        <button className="button secondary" onClick={close}>
          Close bookings
        </button>
      </div>
      <p>
        A maintenance block prevents new bookings and check-in. Use Reservations to reassign
        affected arrivals; active guests need assistance from the front desk.
      </p>
      <QueryContent query={query}>
        {(data) => (
          <>
            <ul>
              {data.reservations.map((booking) => (
                <li key={booking._id}>
                  {booking.contact.name} · {booking.reference} · {booking.checkIn} →{' '}
                  {booking.checkOut} · {booking.status}
                </li>
              ))}
            </ul>
            {!data.reservations.length && <p>No outstanding bookings for this room.</p>}
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </QueryContent>
    </section>
  );
}

export default function WorkOrders({ hotel, maintenance = false }) {
  const { user } = useAuth();
  const manager = ['admin', 'manager'].includes(user.role);
  const desk = ['admin', 'manager', 'receptionist'].includes(user.role);
  const resource = maintenance ? 'maintenance' : 'housekeeping';
  const workerRole = maintenance ? 'maintenance' : 'housekeeping';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [action, setAction] = useState(null);
  const [history, setHistory] = useState(null);
  const [affected, setAffected] = useState(null);
  const query = useQuery({
    queryKey: ['hms', resource, hotel, page, status, search],
    queryFn: () => get(resource, { hotel, page, limit: 10, search, ...(status ? { status } : {}) }),
  });
  const rooms = useQuery({
    queryKey: ['hms', 'work-room-options', hotel, user.role],
    enabled: !!form && !editing,
    queryFn: async () =>
      user.role === 'user'
        ? (await all('stays', 'stays', { hotel, status: 'active' })).map((stay) => stay.room)
        : all('rooms', 'rooms', { hotel }),
  });
  const workers = useQuery({
    queryKey: ['hms', 'assignees', hotel, workerRole],
    enabled: !!form && (maintenance ? manager : desk),
    queryFn: () => all('assignees', 'staff', { hotel, role: workerRole }),
  });
  const save = useSave(
    () => {
      const values = maintenance
        ? {
            ...(editing
              ? {}
              : { hotel, room: form.room, title: form.title, description: form.description }),
            assignedTo: form.assignedTo || null,
            priority: form.priority,
            blocksRoom: form.blocksRoom === 'true',
          }
        : {
            ...(editing ? {} : { hotel, room: form.room }),
            assignedTo: form.assignedTo || null,
            scheduledFor: new Date(form.scheduledFor).toISOString(),
            notes: form.notes,
          };
      return editing
        ? api.put(`/hms/${resource}/${editing._id}`, { ...values, version: editing.version })
        : api.post(`/hms/${resource}`, values);
    },
    () => setForm(null),
  );
  const perform = useSave(
    () =>
      api.post(`/hms/${resource}/${action.row._id}/action`, {
        version: action.row.version,
        action: action.name,
        notes: action.notes,
      }),
    () => setAction(null),
  );
  const change = (name, value) => setForm({ ...form, [name]: value });
  function edit(row) {
    setEditing(row || null);
    setForm(
      maintenance
        ? {
            room: row?.room?._id || '',
            title: row?.title || '',
            description: row?.description || '',
            priority: row?.priority || 'normal',
            blocksRoom: String(row?.blocksRoom || false),
            assignedTo: row?.assignedTo?._id || '',
          }
        : {
            room: row?.room?._id || '',
            assignedTo: row?.assignedTo?._id || '',
            scheduledFor: localTime(row?.scheduledFor),
            notes: row?.notes || '',
          },
    );
  }
  return (
    <>
      <div className="toolbar">
        <h2>{maintenance ? 'Maintenance requests' : 'Housekeeping tasks'}</h2>
        {(maintenance || desk) && (
          <button className="button" disabled={save.isPending} onClick={() => edit()}>
            {maintenance ? 'Report issue' : 'Schedule cleaning'}
          </button>
        )}
      </div>
      <p>
        {maintenance
          ? 'Report issues, track repairs and return rooms to service after cleaning.'
          : 'Departure and repair cleaning tasks are created automatically. Assign a cleaner, start the task, then record completion.'}
      </p>
      {!maintenance && <CleaningQueue hotel={hotel} />}
      <div className="hms-fields">
        <Field
          label="Work status"
          name="status"
          value={status}
          change={(_name, value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            ['', 'All statuses'],
            ...(maintenance
              ? ['open', 'in_progress', 'resolved']
              : ['pending', 'in_progress', 'completed']
            ).map((v) => [v, v.replaceAll('_', ' ')]),
          ]}
        />
        <Field
          label="Search work"
          name="search"
          value={search}
          change={(_name, value) => {
            setSearch(value);
            setPage(1);
          }}
          maxLength={100}
          required={false}
        />
      </div>
      {form && (
        <section className="card hms-form">
          <h3>
            {editing
              ? 'Assignment & scheduling'
              : maintenance
                ? 'Report maintenance issue'
                : 'Schedule cleaning task'}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <fieldset className="hms-fields" disabled={save.isPending}>
              {!editing && (
                <>
                  <Field
                    label="Room"
                    name="room"
                    value={form.room}
                    change={change}
                    options={[
                      ['', 'Choose room'],
                      ...(rooms.data || []).map((room) => [room._id, room.number]),
                    ]}
                  />
                  {rooms.isError && <ErrorState error={rooms.error} retry={rooms.refetch} />}
                  {rooms.data?.length === 0 && (
                    <p>
                      {user.role === 'user'
                        ? 'An active stay is required to report a room issue.'
                        : 'No rooms available.'}
                    </p>
                  )}
                </>
              )}
              {maintenance ? (
                <>
                  {!editing && (
                    <>
                      <Field
                        label="Issue title"
                        name="title"
                        value={form.title}
                        change={change}
                        maxLength={120}
                      />
                      <Field
                        label="Issue description"
                        name="description"
                        value={form.description}
                        change={change}
                        maxLength={2000}
                      />
                    </>
                  )}
                  <Field
                    label="Priority"
                    name="priority"
                    value={form.priority}
                    change={change}
                    options={['low', 'normal', 'high', 'urgent'].map((v) => [v, v])}
                  />
                  {manager && (
                    <Field
                      label="Block booking and check-in"
                      name="blocksRoom"
                      value={form.blocksRoom}
                      change={change}
                      options={
                        editing?.blocksRoom
                          ? [['true', 'Blocked until resolved']]
                          : [
                              ['false', 'No'],
                              ['true', 'Yes — repair required'],
                            ]
                      }
                    />
                  )}
                </>
              ) : (
                <>
                  <Field
                    label="Scheduled cleaning time"
                    name="scheduledFor"
                    value={form.scheduledFor}
                    change={change}
                    type="datetime-local"
                  />
                  <Field
                    label="Cleaning instructions"
                    name="notes"
                    value={form.notes}
                    change={change}
                    maxLength={1000}
                    required={false}
                  />
                </>
              )}
              {(maintenance ? manager : desk) && (
                <>
                  <Field
                    label="Assigned worker"
                    name="assignedTo"
                    value={form.assignedTo}
                    change={change}
                    required={false}
                    options={[
                      ['', 'Unassigned'],
                      ...(workers.data || []).map((worker) => [worker._id, worker.name]),
                      ...(editing?.assignedTo &&
                      !workers.data?.some((worker) => worker._id === editing.assignedTo._id)
                        ? [
                            [
                              editing.assignedTo._id,
                              `${editing.assignedTo.name} (unavailable — reassign)`,
                            ],
                          ]
                        : []),
                    ]}
                  />
                  {workers.isError && <ErrorState error={workers.error} retry={workers.refetch} />}
                </>
              )}
            </fieldset>
            {maintenance && form.blocksRoom === 'true' && (
              <p>
                Existing bookings remain on record. Review affected bookings and arrange
                reassignment where needed.
              </p>
            )}
            <div className="toolbar">
              <button className="button" disabled={save.isPending || (!editing && !rooms.data)}>
                Save work order
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
      {action && (
        <section className="card hms-form">
          <h3>
            {action.name === 'reopen'
              ? 'Reopen repair'
              : action.name === 'resolve'
                ? 'Resolve repair'
                : action.name === 'complete'
                  ? 'Complete cleaning'
                  : 'Start work'}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              perform.mutate();
            }}
          >
            <Field
              label="Work / resolution notes"
              name="notes"
              value={action.notes}
              change={(_name, value) => setAction({ ...action, notes: value })}
              maxLength={maintenance ? 2000 : 1000}
            />
            <div className="toolbar">
              <button className="button" disabled={perform.isPending}>
                Confirm work action
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={perform.isPending}
                onClick={() => setAction(null)}
              >
                Cancel action
              </button>
            </div>
          </form>
        </section>
      )}
      {history && (
        <History
          key={history}
          path={`${resource}/${history}/history`}
          close={() => setHistory(null)}
        />
      )}
      {affected && (
        <AffectedBookings key={affected} id={affected} close={() => setAffected(null)} />
      )}
      <section className="card">
        <QueryContent query={query}>
          {(data) => {
            const rows = maintenance ? data.requests : data.tasks;
            return (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Room / work</th>
                        <th>{maintenance ? 'Priority / block' : 'Scheduled for'}</th>
                        <th>Assigned to</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const canPerform =
                          manager || (user.role === workerRole && row.assignedTo?._id === user._id);
                        return (
                          <tr key={row._id}>
                            <td>
                              Room {row.room.number}
                              <p>{maintenance ? row.title : row.notes || 'Cleaning'}</p>
                              {maintenance && <small>{row.description}</small>}
                              {(row.resolution || row.completionNotes) && (
                                <p>{row.resolution || row.completionNotes}</p>
                              )}
                            </td>
                            <td>
                              {maintenance ? (
                                <>
                                  {row.priority}
                                  {row.blocksRoom && (
                                    <p>
                                      {row.status === 'resolved'
                                        ? 'Block resolved'
                                        : 'Blocks booking'}
                                    </p>
                                  )}
                                </>
                              ) : (
                                new Date(row.scheduledFor).toLocaleString()
                              )}
                            </td>
                            <td>
                              {row.assignedTo?.name || 'Unassigned'}
                              {row.assignedTo?.isActive === false && ' (inactive)'}
                            </td>
                            <td>{row.status.replaceAll('_', ' ')}</td>
                            <td>
                              <div className="hms-actions">
                                {(maintenance
                                  ? manager && row.status !== 'resolved'
                                  : desk && row.open) && (
                                  <button
                                    className="button secondary small"
                                    onClick={() => edit(row)}
                                  >
                                    Assign / edit
                                  </button>
                                )}
                                {canPerform &&
                                  row.status === (maintenance ? 'open' : 'pending') && (
                                    <button
                                      className="button small"
                                      onClick={() => setAction({ row, name: 'start', notes: '' })}
                                    >
                                      Start work
                                    </button>
                                  )}
                                {canPerform && row.status === 'in_progress' && (
                                  <button
                                    className="button small"
                                    onClick={() =>
                                      setAction({
                                        row,
                                        name: maintenance ? 'resolve' : 'complete',
                                        notes: '',
                                      })
                                    }
                                  >
                                    {maintenance ? 'Resolve repair' : 'Complete cleaning'}
                                  </button>
                                )}
                                {maintenance && manager && row.status === 'resolved' && (
                                  <button
                                    className="button secondary small"
                                    onClick={() => setAction({ row, name: 'reopen', notes: '' })}
                                  >
                                    Reopen
                                  </button>
                                )}
                                {maintenance && desk && row.blocksRoom && (
                                  <button
                                    className="button secondary small"
                                    onClick={() => setAffected(row._id)}
                                  >
                                    Affected bookings
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
                {!rows.length && <p className="empty">No work matches this filter.</p>}
                <Pagination pagination={data.pagination} onPageChange={setPage} />
              </>
            );
          }}
        </QueryContent>
      </section>
    </>
  );
}
