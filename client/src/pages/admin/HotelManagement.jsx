import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../../api/axios.js';
import useAuth from '../../hooks/useAuth.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';

const emptyHotel = {
  name: '',
  code: '',
  address: '',
  city: '',
  country: '',
  email: '',
  phone: '',
  isActive: true,
};
const emptyStaff = {
  name: '',
  email: '',
  password: '',
  role: 'receptionist',
  hotel: '',
  phone: '',
  jobTitle: '',
  isActive: true,
};
const roles = ['manager', 'receptionist', 'housekeeping', 'maintenance'];

export default function HotelManagement({ staff = false }) {
  const { user } = useAuth();
  const canEdit = user.role === 'admin';
  const resource = staff ? 'staff' : 'hotels';
  const title = staff ? 'Hotel staff' : 'Hotels & branches';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [resource, page, search],
    queryFn: async () =>
      (await api.get(`/${resource}`, { params: { page, limit: 10, search } })).data,
  });
  const hotels = useQuery({
    queryKey: ['hotel-options'],
    enabled: staff && canEdit,
    queryFn: async () => {
      const all = [];
      let page = 1;
      let pages;
      do {
        const { data } = await api.get('/hotels', { params: { page, limit: 100 } });
        all.push(...data.hotels);
        pages = data.pagination.pages;
        page += 1;
      } while (page <= pages);
      return all;
    },
  });
  const mutation = useMutation({
    mutationFn: () => (id ? api.put(`/${resource}/${id}`, form) : api.post(`/${resource}`, form)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [resource] });
      client.invalidateQueries({ queryKey: ['hotel-options'] });
      client.invalidateQueries({ queryKey: ['users'] });
      setForm(null);
      toast.success('Saved successfully');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  function edit(record) {
    const defaults = staff ? emptyStaff : emptyHotel;
    const values = Object.fromEntries(
      Object.keys(defaults)
        .filter((key) => !staff || !['email', 'password'].includes(key))
        .map((key) => [key, record[key] ?? defaults[key]]),
    );
    if (staff) values.hotel = record.hotel?._id || record.hotel || '';
    setId(record._id);
    setForm(values);
  }
  function field(name, label, type = 'text', maxLength = 120, required = true) {
    return (
      <label key={name} className="hms-field">
        {label}
        <input
          type={type}
          maxLength={maxLength}
          required={required}
          minLength={name === 'password' ? 8 : undefined}
          value={form[name]}
          onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        />
      </label>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Luxury Star Hotel</p>
          <h1>{title}</h1>
          <p>
            {staff
              ? 'Manage staff roles, contact details and hotel assignments.'
              : 'Manage property details and operating status.'}
          </p>
        </div>
        {canEdit && (
          <button
            className="button"
            onClick={() => {
              setId(null);
              setForm({ ...(staff ? emptyStaff : emptyHotel) });
            }}
          >
            Add {staff ? 'staff member' : 'hotel'}
          </button>
        )}
      </div>
      {form && (
        <section className="card hms-form">
          <h2>
            {id ? 'Edit' : 'Create'} {staff ? 'staff member' : 'hotel'}
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <fieldset disabled={mutation.isPending} className="hms-fields">
              {field('name', 'Name', 'text', staff ? 80 : 120)}
              {(!staff || !id) && field('email', 'Email', 'email', 254)}
              {field('phone', 'Phone', 'tel', 30, false)}
              {staff ? (
                <>
                  {!id && field('password', 'Initial password', 'password', 72)}
                  {field('jobTitle', 'Job title', 'text', 80, false)}
                  <label className="hms-field">
                    Role
                    <select
                      value={form.role}
                      onChange={(event) => setForm({ ...form, role: event.target.value })}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="hms-field">
                    Hotel
                    <select
                      required
                      value={form.hotel}
                      onChange={(event) => setForm({ ...form, hotel: event.target.value })}
                    >
                      <option value="">Select hotel</option>
                      {(hotels.data || [])
                        .filter((hotel) => hotel.isActive || hotel._id === form.hotel)
                        .map((hotel) => (
                          <option key={hotel._id} value={hotel._id}>
                            {hotel.name}
                            {hotel.isActive ? '' : ' (inactive)'}
                          </option>
                        ))}
                    </select>
                  </label>
                  {hotels.isError && <ErrorState error={hotels.error} retry={hotels.refetch} />}
                  {hotels.isPending && <p>Loading hotel choices…</p>}
                </>
              ) : (
                <>
                  {field('code', 'Unique hotel code', 'text', 20)}
                  {field('address', 'Address', 'text', 300)}
                  {field('city', 'City', 'text', 100)}
                  {field('country', 'Country', 'text', 100)}
                </>
              )}
              <label className="hms-field">
                Status
                <select
                  value={String(form.isActive)}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.value === 'true' })
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </fieldset>
            <div className="toolbar">
              <button className="button" disabled={mutation.isPending || (staff && !hotels.data)}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={mutation.isPending}
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="card">
        <div className="toolbar">
          <input
            aria-label={`Search ${resource}`}
            placeholder={`Search ${resource}…`}
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
                    <th>{staff ? 'Role' : 'Code'}</th>
                    <th>{staff ? 'Hotel' : 'Location'}</th>
                    <th>Email</th>
                    <th>Status</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {query.data[resource].map((record) => (
                    <tr key={record._id}>
                      <td>{record.name}</td>
                      <td>{staff ? record.role : record.code}</td>
                      <td>
                        {staff
                          ? record.hotel?.name || 'Unassigned'
                          : `${record.city}, ${record.country}`}
                      </td>
                      <td>{record.email}</td>
                      <td>{record.isActive ? 'Active' : 'Inactive'}</td>
                      {canEdit && (
                        <td>
                          <button
                            className="button secondary small"
                            disabled={mutation.isPending}
                            onClick={() => edit(record)}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {query.data[resource].length === 0 && (
                <div className="empty">
                  No {resource} found.{canEdit && ' Add your first record above.'}
                </div>
              )}
            </div>
            <Pagination pagination={query.data.pagination} onPageChange={setPage} />
          </>
        )}
      </section>
    </>
  );
}
