import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountApi } from '../../api/account.api.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';

const actions = [
  'policy.update',
  'policy.reset',
  'settings.update',
  'user.role',
  'user.active',
  'user.delete',
  'category.create',
  'category.update',
  'category.delete',
  'media.upload',
  'media.delete',
];
export default function ActivityLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const query = useQuery({
    queryKey: ['audit', page, action],
    queryFn: () => accountApi.audit({ page, limit: 15, ...(action ? { action } : {}) }),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace history</p>
          <h1>Activity log</h1>
          <p>Review hotel policies, global settings, account changes and system activity.</p>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
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
            {actions.map((item) => (
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
                    <th>Administrator</th>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.events.map((event) => (
                    <tr key={event._id}>
                      <td>{new Date(event.createdAt).toLocaleString()}</td>
                      <td>{event.actor?.name || 'Deleted account'}</td>
                      <td>{event.action}</td>
                      <td>{event.target}</td>
                      <td>
                        {Object.entries(event.details || {})
                          .map(
                            ([key, value]) =>
                              `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
                          )
                          .join(', ') || '—'}
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
