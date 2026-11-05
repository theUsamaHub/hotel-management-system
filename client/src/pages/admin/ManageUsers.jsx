import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { userApi } from '../../api/user.api.js';
import { errorMessage } from '../../api/axios.js';
import useAuth from '../../hooks/useAuth.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';

export default function ManageUsers() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['users', { page, search }],
    queryFn: () => userApi.list({ page, search, limit: 8 }),
    placeholderData: keepPreviousData,
  });
  const mutation = useMutation({
    mutationFn: ({ type, ...values }) => userApi[type](values),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['users'] });
      toast.success('Account updated');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Better together</p>
          <h1>Team members</h1>
          <p>Manage the people and permissions in your workspace.</p>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
          <input
            aria-label="Search users"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
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
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.users.map((member) => (
                    <tr key={member._id}>
                      <td>
                        <strong>{member.name}</strong>
                        {member._id === user._id && <small> (you)</small>}
                      </td>
                      <td className="muted">{member.email}</td>
                      <td>
                        <select
                          aria-label={`Role for ${member.name}`}
                          value={member.role}
                          disabled={member._id === user._id || mutation.isPending}
                          onChange={(event) =>
                            mutation.mutate({
                              type: 'role',
                              id: member._id,
                              role: event.target.value,
                            })
                          }
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          {!['admin', 'user'].includes(member.role) && <option value={member.role}>{member.role}</option>}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${member.isActive ? '' : 'inactive'}`}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="button secondary small"
                          disabled={member._id === user._id || mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              type: 'active',
                              id: member._id,
                              isActive: !member.isActive,
                            })
                          }
                        >
                          {member.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {query.data.users.length === 0 && (
                <div className="empty">No team members match your search.</div>
              )}
            </div>
            <Pagination pagination={query.data.pagination} onPageChange={setPage} />
          </>
        )}
      </section>
    </>
  );
}
