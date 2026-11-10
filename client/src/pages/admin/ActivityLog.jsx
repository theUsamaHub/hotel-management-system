import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountApi } from '../../api/account.api.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';

export default function ActivityLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const query = useQuery({
    queryKey: ['audit', page, action, search, role],
    queryFn: () =>
      accountApi.audit({
        page,
        limit: 15,
        search,
        ...(role ? { role } : {}),
        ...(action ? { action } : {}),
      }),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace history</p>
          <h1>Activity log</h1>
          <p>
            Review recorded actions by guests, hotel staff and administrators, including your own
            activity. New events retain the name and role used at the time.
          </p>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
          <label>
            Search name, user ID or record ID
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Name or ID"
            />
          </label>
          <label>
            Role
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Every role</option>
              {['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance', 'user'].map(
                (r) => (
                  <option key={r} value={r}>
                    {r === 'user' ? 'Guest' : r}
                  </option>
                ),
              )}
            </select>
          </label>
          <label htmlFor="audit-action">Filter activity</label>
          <select
            id="audit-action"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All activity</option>
            {(query.data?.actions || []).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        {query.isPending ? (
          <Loader />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={query.refetch} />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Person / user ID</th>
                    <th>Role at action</th>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.events.map((event) => (
                    <tr key={event._id}>
                      <td>{new Date(event.createdAt).toLocaleString()}</td>
                      <td>
                        <strong>
                          {event.actorSnapshot?.name || event.actor?.name || 'Deleted account'}
                        </strong>
                        <small className="audit-id">
                          {event.actorSnapshot?.id || event.actorId || event.actor?._id}
                        </small>
                      </td>
                      <td>
                        {event.actorSnapshot?.role || event.actor?.role || 'Not recorded'}
                        {!event.actorSnapshot?.role && event.actor?.role && (
                          <small className="audit-id">Current role (legacy event)</small>
                        )}
                      </td>
                      <td>{event.action}</td>
                      <td className="audit-target">{event.target}</td>
                      <td>
                        <details>
                          <summary>View details</summary>
                          <pre className="audit-details">
                            {Object.entries(event.details || {})
                              .map(
                                ([key, value]) =>
                                  `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
                              )
                              .join('\n') || 'No additional details'}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!query.data.events.length && <p className="empty">No activity recorded yet.</p>}
            </div>
            <Pagination pagination={query.data.pagination} onPageChange={setPage} />
          </>
        )}
      </section>
    </>
  );
}
