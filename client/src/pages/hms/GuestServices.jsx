import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import useAuth from '../../hooks/useAuth.js';
import Pagination from '../../components/Pagination.jsx';
import { all, get, money, Field, History, QueryContent, useSave } from './shared.jsx';

function Catalog({ hotel, manager }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);
  const query = useQuery({
    queryKey: ['hms', 'services', hotel, page, search],
    queryFn: () => get('services', { hotel, page, limit: 10, search }),
  });
  const save = useSave(
    () => {
      const data = {
        name: form.name,
        description: form.description,
        unitPrice: Math.round(Number(form.price) * 100),
        currency: form.currency,
        isActive: form.active === 'true',
      };
      return id
        ? api.put(`/hms/services/${id}`, data)
        : api.post('/hms/services', { ...data, hotel });
    },
    () => setForm(null),
  );
  function edit(service) {
    setId(service?._id || null);
    setForm({
      name: service?.name || '',
      description: service?.description || '',
      price: service ? service.unitPrice / 100 : '',
      currency: service?.currency || 'PKR',
      active: String(service?.isActive ?? true),
    });
  }
  const change = (name, value) => setForm({ ...form, [name]: value });
  return (
    <section className="card hms-form">
      <div className="toolbar">
        <h3>Service catalog</h3>
        {manager && (
          <button className="button" onClick={() => edit()}>
            Add service
          </button>
        )}
      </div>
      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset className="hms-fields" disabled={save.isPending}>
            <Field
              label="Service name"
              name="name"
              value={form.name}
              change={change}
              maxLength={100}
            />
            <Field
              label="Service description"
              name="description"
              value={form.description}
              change={change}
              maxLength={1000}
              required={false}
            />
            <Field
              label="Service unit price"
              name="price"
              value={form.price}
              change={change}
              type="number"
              min="0"
              max="1000000"
              step="0.01"
            />
            <Field
              label="Service currency"
              name="currency"
              value={form.currency}
              change={change}
              options={['PKR', 'USD', 'EUR', 'GBP', 'AED'].map((v) => [v, v])}
            />
            <Field
              label="Service availability"
              name="active"
              value={form.active}
              change={change}
              options={[
                ['true', 'Active'],
                ['false', 'Inactive'],
              ]}
            />
          </fieldset>
          <div className="toolbar">
            <button className="button" disabled={save.isPending}>
              Save service
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
      )}
      <Field
        label="Search catalog"
        name="search"
        value={search}
        change={(_name, value) => {
          setSearch(value);
          setPage(1);
        }}
        required={false}
        maxLength={100}
      />
      <QueryContent query={query}>
        {(data) => (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Unit price</th>
                    <th>Status</th>
                    {manager && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((service) => (
                    <tr key={service._id}>
                      <td>
                        {service.name}
                        <p>{service.description}</p>
                      </td>
                      <td>{money(service.unitPrice, service.currency)}</td>
                      <td>{service.isActive ? 'Active' : 'Inactive'}</td>
                      {manager && (
                        <td>
                          <button className="button secondary small" onClick={() => edit(service)}>
                            Edit service
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.services.length && <p>No services found.</p>}
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </QueryContent>
    </section>
  );
}

function RequestForm({ hotel, close }) {
  const [form, setForm] = useState({ stay: '', service: '', quantity: 1, notes: '' });
  const stays = useQuery({
    queryKey: ['hms', 'service-stays', hotel],
    queryFn: () => all('stays', 'stays', { hotel, status: 'active' }),
  });
  const services = useQuery({
    queryKey: ['hms', 'service-options', hotel],
    queryFn: () => all('services', 'services', { hotel }),
  });
  const selectedStay = stays.data?.find((stay) => stay._id === form.stay);
  const selectedService = services.data?.find((service) => service._id === form.service);
  const change = (name, value) =>
    setForm({ ...form, [name]: value, ...(name === 'stay' ? { service: '' } : {}) });
  const save = useSave(
    () => api.post('/hms/service-requests', { ...form, quantity: Number(form.quantity) }),
    close,
  );
  return (
    <section className="card hms-form">
      <h3>Request guest service</h3>
      <QueryContent query={stays}>
        {(rows) =>
          rows.length ? (
            <QueryContent query={services}>
              {(catalog) => (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate();
                  }}
                >
                  <fieldset className="hms-fields" disabled={save.isPending}>
                    <Field
                      label="Service stay"
                      name="stay"
                      value={form.stay}
                      change={change}
                      options={[
                        ['', 'Choose active stay'],
                        ...rows.map((stay) => [
                          stay._id,
                          `${stay.reservation.contact.name} · Room ${stay.room.number}`,
                        ]),
                      ]}
                    />
                    <Field
                      label="Requested service"
                      name="service"
                      value={form.service}
                      change={change}
                      options={[
                        ['', 'Choose service'],
                        ...catalog
                          .filter(
                            (service) =>
                              service.isActive &&
                              service.currency === selectedStay?.reservation.quote.currency,
                          )
                          .map((service) => [
                            service._id,
                            `${service.name} · ${money(service.unitPrice, service.currency)}`,
                          ]),
                      ]}
                    />
                    <Field
                      label="Service quantity"
                      name="quantity"
                      value={form.quantity}
                      change={change}
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                    />
                    <Field
                      label="Request notes"
                      name="notes"
                      value={form.notes}
                      change={change}
                      maxLength={1000}
                      required={false}
                    />
                  </fieldset>
                  {selectedService && (
                    <p>
                      Charge on completion:{' '}
                      {money(
                        selectedService.unitPrice * Number(form.quantity),
                        selectedService.currency,
                      )}
                      . This rate is saved with your request.
                    </p>
                  )}
                  <div className="toolbar">
                    <button className="button" disabled={save.isPending}>
                      Submit service request
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={save.isPending}
                      onClick={close}
                    >
                      Cancel request form
                    </button>
                  </div>
                </form>
              )}
            </QueryContent>
          ) : (
            <p>An active stay is required to request services.</p>
          )
        }
      </QueryContent>
    </section>
  );
}
export default function GuestServices({ hotel }) {
  const { user } = useAuth();
  const desk = ['admin', 'manager', 'receptionist'].includes(user.role);
  const manager = ['admin', 'manager'].includes(user.role);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [create, setCreate] = useState(false);
  const [action, setAction] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [history, setHistory] = useState(null);
  const query = useQuery({
    queryKey: ['hms', 'service-requests', hotel, page, status],
    queryFn: () =>
      get('service-requests', { hotel, page, limit: 10, ...(status ? { status } : {}) }),
  });
  const workers = useQuery({
    queryKey: ['hms', 'service-assignees', hotel],
    enabled: !!assignment,
    queryFn: () => all('service-assignees', 'staff', { hotel }),
  });
  const assign = useSave(
    () =>
      api.put(`/hms/service-requests/${assignment.row._id}/assignment`, {
        version: assignment.row.version,
        assignedTo: assignment.assignedTo || null,
      }),
    () => setAssignment(null),
  );
  const perform = useSave(
    () =>
      api.post(`/hms/service-requests/${action.row._id}/action`, {
        version: action.row.version,
        action: action.name,
        notes: action.notes,
      }),
    () => setAction(null),
  );
  return (
    <>
      <h2>Guest services</h2>
      <Catalog hotel={hotel} manager={manager} />
      <div className="toolbar">
        <h3>Service requests</h3>
        {(desk || user.role === 'user') && (
          <button className="button" onClick={() => setCreate(true)}>
            Request service
          </button>
        )}
      </div>
      {create && <RequestForm hotel={hotel} close={() => setCreate(false)} />}
      <Field
        label="Service request status"
        name="status"
        value={status}
        change={(_name, value) => {
          setStatus(value);
          setPage(1);
        }}
        options={[
          ['', 'All'],
          ...['pending', 'in_progress', 'completed', 'cancelled'].map((v) => [
            v,
            v.replaceAll('_', ' '),
          ]),
        ]}
      />
      {assignment && (
        <section className="card hms-form">
          <QueryContent query={workers}>
            {(rows) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  assign.mutate();
                }}
              >
                <Field
                  label="Service worker"
                  name="assignedTo"
                  value={assignment.assignedTo}
                  change={(_name, value) => setAssignment({ ...assignment, assignedTo: value })}
                  required={false}
                  options={[
                    ['', 'Unassigned'],
                    ...rows.map((worker) => [worker._id, `${worker.name} · ${worker.role}`]),
                  ]}
                />
                <div className="toolbar">
                  <button className="button" disabled={assign.isPending}>
                    Save service assignment
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={assign.isPending}
                    onClick={() => setAssignment(null)}
                  >
                    Cancel assignment
                  </button>
                </div>
              </form>
            )}
          </QueryContent>
        </section>
      )}
      {action && (
        <section className="card hms-form">
          <h3>{action.name} service</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              perform.mutate();
            }}
          >
            <Field
              label="Service action notes"
              name="notes"
              value={action.notes}
              change={(_name, value) => setAction({ ...action, notes: value })}
              maxLength={1000}
            />
            <div className="toolbar">
              <button className="button" disabled={perform.isPending}>
                Confirm service action
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
          path={`service-requests/${history}/history`}
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
                      <th>Service / room</th>
                      <th>Saved amount</th>
                      <th>Assigned to</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map((request) => {
                      const work =
                        desk || (user.role !== 'user' && request.assignedTo?._id === user._id);
                      const open = ['pending', 'in_progress'].includes(request.status);
                      return (
                        <tr key={request._id}>
                          <td>
                            {request.snapshot.name} · Room {request.stay.room.number}
                            <p>{request.notes}</p>
                            {request.completionNotes && <p>{request.completionNotes}</p>}
                          </td>
                          <td>
                            {request.quantity} ×{' '}
                            {money(request.snapshot.unitPrice, request.snapshot.currency)}
                          </td>
                          <td>{request.assignedTo?.name || 'Unassigned'}</td>
                          <td>{request.status.replaceAll('_', ' ')}</td>
                          <td>
                            <div className="hms-actions">
                              {desk && open && (
                                <button
                                  className="button secondary small"
                                  onClick={() =>
                                    setAssignment({
                                      row: request,
                                      assignedTo: request.assignedTo?._id || '',
                                    })
                                  }
                                >
                                  Assign service
                                </button>
                              )}
                              {work && request.status === 'pending' && (
                                <button
                                  className="button small"
                                  onClick={() =>
                                    setAction({ row: request, name: 'start', notes: '' })
                                  }
                                >
                                  Start service
                                </button>
                              )}
                              {work && request.status === 'in_progress' && (
                                <button
                                  className="button small"
                                  onClick={() =>
                                    setAction({ row: request, name: 'complete', notes: '' })
                                  }
                                >
                                  Complete & charge
                                </button>
                              )}
                              {open && (work || request.status === 'pending') && (
                                <button
                                  className="button secondary small"
                                  onClick={() =>
                                    setAction({ row: request, name: 'cancel', notes: '' })
                                  }
                                >
                                  Cancel service
                                </button>
                              )}
                              <button
                                className="button secondary small"
                                onClick={() => setHistory(request._id)}
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
              {!data.requests.length && <p className="empty">No service requests found.</p>}
              <Pagination pagination={data.pagination} onPageChange={setPage} />
            </>
          )}
        </QueryContent>
      </section>
    </>
  );
}
