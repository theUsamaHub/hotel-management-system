import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../../api/axios.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';

export const money = (amount, currency) =>
  (amount / 100).toLocaleString(undefined, { style: 'currency', currency });
export const dateAfter = (days) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const fail = (error) =>
  toast.error(error.response?.data?.errors?.[0]?.message || errorMessage(error));
export const get = async (path, params) => (await api.get(`/hms/${path}`, { params })).data;
export async function all(path, key, params = {}) {
  const rows = [];
  let page = 1;
  let pages;
  do {
    const data = await get(path, { ...params, page, limit: 100 });
    rows.push(...data[key]);
    pages = data.pagination.pages;
    page += 1;
  } while (page <= pages);
  return rows;
}
export function useSave(fn, success) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ['hms'] });
      toast.success('Saved successfully');
      success?.(result);
    },
    onError: (error) => {
      fail(error);
      if (error.response?.status === 409) client.invalidateQueries({ queryKey: ['hms'] });
    },
  });
}
export function QueryContent({ query, children }) {
  if (query.isPending) return <Loader />;
  if (query.isError) return <ErrorState error={query.error} retry={query.refetch} />;
  return children(query.data);
}
export function Field({
  label,
  name,
  value,
  change,
  type = 'text',
  options,
  required = true,
  maxLength,
  min,
  max,
  step,
}) {
  return (
    <label className="hms-field">
      {label}
      {options ? (
        <select required={required} value={value} onChange={(e) => change(name, e.target.value)}>
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          value={value}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
          onChange={(e) => change(name, e.target.value)}
        />
      )}
    </label>
  );
}
export function History({ path, close }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['hms', 'history', path, page],
    queryFn: () => get(path, { page, limit: 10 }),
  });
  return (
    <section className="card hms-form">
      <div className="toolbar">
        <h2>History</h2>
        <button className="button secondary" onClick={close}>
          Close history
        </button>
      </div>
      <QueryContent query={query}>
        {(data) => (
          <>
            {data.events.length === 0 && <p>No history recorded.</p>}
            {data.events.map((event) => (
              <article className="hms-history" key={event._id}>
                <strong>
                  {event.action
                    ? event.action
                        .replaceAll('.', ' ')
                        .replaceAll('_', ' ')
                        .replace('update', 'updated')
                    : `${event.from || 'New'} → ${event.to}`}
                </strong>
                <p>
                  {new Date(event.createdAt).toLocaleString()}
                  {event.actor?.name ? ` · ${event.actor.name}` : ''}
                </p>
                {(event.reason || event.details?.reason) && (
                  <p>{event.reason || event.details.reason}</p>
                )}
                {event.details?.label && <p>Key: {event.details.label}</p>}
                {event.details?.keys && <p>Issued keys: {event.details.keys.join(', ')}</p>}
                {event.details?.settlement && (
                  <p>
                    Room settlement:{' '}
                    {money(event.details.settlement.amount, event.details.settlement.currency)} ·{' '}
                    {event.details.settlement.reference}
                  </p>
                )}
                {event.details?.before && (
                  <p>
                    Before: {event.details.before.checkIn} → {event.details.before.checkOut}, room{' '}
                    {event.details.before.quote.roomNumber},{' '}
                    {money(event.details.before.quote.total, event.details.before.quote.currency)}
                  </p>
                )}
                {event.details?.after && (
                  <p>
                    After: {event.details.after.checkIn} → {event.details.after.checkOut}, room{' '}
                    {event.details.after.quote.roomNumber},{' '}
                    {money(event.details.after.quote.total, event.details.after.quote.currency)}
                  </p>
                )}
              </article>
            ))}
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </QueryContent>
    </section>
  );
}
