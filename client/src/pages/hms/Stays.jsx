import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import Pagination from '../../components/Pagination.jsx';
import { get, money, Field, History, QueryContent, useSave } from './shared.jsx';

export function CheckInForm({ booking, close }) {
  const [note, setNote] = useState('');
  const [keys, setKeys] = useState('');
  const [verified, setVerified] = useState(false);
  const save = useSave(
    () =>
      api.post(`/hms/reservations/${booking._id}/check-in`, {
        version: booking.version,
        guestVerified: verified,
        verificationNote: note,
        keys: keys
          .split(',')
          .map((key) => key.trim())
          .filter(Boolean),
      }),
    close,
  );
  return (
    <section className="card hms-form">
      <h3>Check in {booking.contact.name}</h3>
      <p>
        Room {booking.quote.roomNumber} · {booking.checkIn} → {booking.checkOut}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset className="hms-fields" disabled={save.isPending}>
          <Field
            label="Verification note"
            name="note"
            value={note}
            change={(_name, value) => setNote(value)}
            maxLength={300}
          />
          <Field
            label="Key labels (comma-separated, up to five)"
            name="keys"
            value={keys}
            change={(_name, value) => setKeys(value)}
            maxLength={204}
          />
          <label>
            <input
              type="checkbox"
              required
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />{' '}
            I verified the arriving guest against this booking.
          </label>
        </fieldset>
        <p className="muted">
          Record how verification was completed; do not enter identity-document numbers or images.
        </p>
        <div className="toolbar">
          <button className="button" disabled={save.isPending}>
            Confirm check-in
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={save.isPending}
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function CheckoutForm({ data, close }) {
  const [amount, setAmount] = useState(
    (data.billing?.balance ?? data.settlementDue.roomTotal) / 100,
  );
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const save = useSave(
    () =>
      api.post(`/hms/stays/${data.stay._id}/check-out`, {
        version: data.stay.version,
        amount: Math.round(Number(amount) * 100),
        currency: data.settlementDue.currency,
        method,
        reference,
        billingReviewed: reviewed,
      }),
    close,
  );
  return (
    <section className="hms-form">
      <h3>Record departure and final settlement</h3>
      <p>
        Room total:{' '}
        <strong>{money(data.settlementDue.roomTotal, data.settlementDue.currency)}</strong>. Extra
        nights after scheduled departure: {data.settlementDue.extraNights}.
      </p>
      <p>
        Review itemized charges, tax, discounts and recorded payments in Billing & invoices first.
        Checkout records the remaining external payment and issues the final invoice. It does not
        charge a card.
      </p>
      {data.billing && (
        <p>
          Total: {money(data.billing.total, data.billing.currency)} · Already paid:{' '}
          {money(data.billing.paid, data.billing.currency)} · Outstanding:{' '}
          {money(data.billing.balance, data.billing.currency)}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset className="hms-fields" disabled={save.isPending}>
          <Field
            label="Outstanding settlement amount"
            name="amount"
            value={amount}
            change={(_name, v) => setAmount(v)}
            type="number"
            min="0"
            step="0.01"
          />
          <Field
            label="Collected by"
            name="method"
            value={method}
            change={(_name, v) => setMethod(v)}
            options={[
              ['cash', 'Cash'],
              ['card', 'External card terminal'],
              ['bank_transfer', 'Bank transfer'],
            ]}
          />
          <Field
            label="External receipt / settlement reference"
            name="reference"
            value={reference}
            change={(_name, v) => setReference(v)}
            maxLength={120}
          />
          <label>
            <input
              type="checkbox"
              required
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{' '}
            I reviewed the full bill and all payments, and collected any remaining amount outside
            this app.
          </label>
        </fieldset>
        <div className="toolbar">
          <button className="button" disabled={save.isPending}>
            Confirm checkout
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={close}
            disabled={save.isPending}
          >
            Cancel checkout
          </button>
        </div>
      </form>
    </section>
  );
}

function StayDetails({ id, isGuest, close }) {
  const query = useQuery({
    queryKey: ['hms', 'stay-detail', id],
    queryFn: () => get(`stays/${id}`),
  });
  const [keyForm, setKeyForm] = useState(null);
  const [label, setLabel] = useState('');
  const [checkout, setCheckout] = useState(false);
  const issue = useSave(
    () => api.post(`/hms/stays/${id}/keys`, { version: query.data.stay.version, label }),
    () => setLabel(''),
  );
  const resolve = useSave(
    () =>
      api.post(`/hms/stays/${id}/keys/${keyForm.id}/close`, {
        version: query.data.stay.version,
        status: keyForm.status,
        note: keyForm.note,
      }),
    () => setKeyForm(null),
  );
  return (
    <section className="card hms-form">
      <div className="toolbar">
        <h3>Stay details & keys</h3>
        <button className="button secondary" onClick={close}>
          Close details
        </button>
      </div>
      <QueryContent query={query}>
        {(data) => (
          <>
            <p>
              {data.reservation.contact.name} · Room {data.reservation.quote.roomNumber} ·{' '}
              {data.stay.status}
            </p>
            <p>
              Arrival recorded: {new Date(data.stay.checkedInAt).toLocaleString()}
              {data.stay.checkedOutAt &&
                ` · Departure: ${new Date(data.stay.checkedOutAt).toLocaleString()}`}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Issued / closed</th>
                    <th>Notes</th>
                    {!isGuest && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.keys.map((key) => (
                    <tr key={key._id}>
                      <td>{key.label}</td>
                      <td>{key.status}</td>
                      <td>
                        {new Date(key.issuedAt).toLocaleString()}
                        {key.closedAt && (
                          <>
                            <br />
                            {new Date(key.closedAt).toLocaleString()}
                          </>
                        )}
                      </td>
                      <td>{key.note || '—'}</td>
                      {!isGuest && (
                        <td>
                          {data.stay.status === 'active' && key.status === 'issued' && (
                            <button
                              className="button secondary small"
                              onClick={() =>
                                setKeyForm({ id: key._id, status: 'returned', note: '' })
                              }
                            >
                              Return / report lost
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isGuest && data.stay.status === 'active' && (
              <>
                {keyForm && (
                  <form
                    className="hms-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      resolve.mutate();
                    }}
                  >
                    <fieldset disabled={resolve.isPending} className="hms-fields">
                      <Field
                        label="Key outcome"
                        name="status"
                        value={keyForm.status}
                        change={(name, value) => setKeyForm({ ...keyForm, [name]: value })}
                        options={[
                          ['returned', 'Returned'],
                          ['lost', 'Lost — access reset required'],
                        ]}
                      />
                      <Field
                        label="Key return / loss note"
                        name="note"
                        value={keyForm.note}
                        change={(name, value) => setKeyForm({ ...keyForm, [name]: value })}
                        maxLength={300}
                      />
                    </fieldset>
                    <div className="toolbar">
                      <button className="button" disabled={resolve.isPending}>
                        Record key outcome
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={resolve.isPending}
                        onClick={() => setKeyForm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                <form
                  className="toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    issue.mutate();
                  }}
                >
                  <Field
                    label="Additional key label"
                    name="label"
                    value={label}
                    change={(_name, value) => setLabel(value)}
                    maxLength={40}
                  />
                  <button className="button secondary" disabled={issue.isPending}>
                    Issue key
                  </button>
                </form>
                {data.keys.some((key) => key.status === 'issued') ? (
                  <p>Record the return or loss of every issued key before checkout.</p>
                ) : (
                  <button className="button" onClick={() => setCheckout(true)}>
                    Check out
                  </button>
                )}
                {checkout && (
                  <CheckoutForm
                    key={data.stay.version}
                    data={data}
                    close={() => setCheckout(false)}
                  />
                )}
              </>
            )}
            {data.stay.status === 'completed' && (
              <p>
                Recorded settlement:{' '}
                {money(data.stay.settlement.amount, data.stay.settlement.currency)} ·{' '}
                {data.stay.settlement.method} · Reference {data.stay.settlement.reference}
              </p>
            )}
          </>
        )}
      </QueryContent>
    </section>
  );
}

export default function Stays({ hotel, isGuest }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const query = useQuery({
    queryKey: ['hms', 'stays', hotel, page, status, search],
    queryFn: () => get('stays', { hotel, page, limit: 10, search, ...(status ? { status } : {}) }),
  });
  return (
    <>
      <h2>{isGuest ? 'My stays' : 'Guest stays'}</h2>
      <p>
        Check in confirmed arrivals from Reservations. Use stay details to account for keys and
        record departure.
      </p>
      <div className="hms-fields">
        <Field
          label="Stay status"
          name="status"
          value={status}
          change={(_name, value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            ['active', 'Active'],
            ['completed', 'Completed'],
            ['', 'All'],
          ]}
        />
        <Field
          label="Search stays"
          name="search"
          value={search}
          change={(_name, value) => {
            setSearch(value);
            setPage(1);
          }}
          required={false}
          maxLength={100}
        />
      </div>
      {selected && (
        <StayDetails
          key={selected}
          id={selected}
          isGuest={isGuest}
          close={() => setSelected(null)}
        />
      )}
      {history && (
        <History key={history} path={`stays/${history}/history`} close={() => setHistory(null)} />
      )}
      <section className="card">
        <QueryContent query={query}>
          {(data) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Guest / booking</th>
                      <th>Room</th>
                      <th>Scheduled dates</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stays.map((stay) => (
                      <tr key={stay._id}>
                        <td>
                          {stay.reservation.contact.name}
                          <small className="hms-reference">{stay.reservation.reference}</small>
                        </td>
                        <td>
                          {stay.room.number}
                          {stay.room.maintenanceBlocked && <small> · Maintenance block</small>}
                        </td>
                        <td>
                          {stay.reservation.checkIn} → {stay.reservation.checkOut}
                        </td>
                        <td>{stay.status}</td>
                        <td>
                          <div className="hms-actions">
                            <button
                              className="button secondary small"
                              onClick={() => setSelected(stay._id)}
                            >
                              Details & keys
                            </button>
                            <button
                              className="button secondary small"
                              onClick={() => setHistory(stay._id)}
                            >
                              History
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.stays.length && <p className="empty">No stays match this filter.</p>}
              <Pagination pagination={data.pagination} onPageChange={setPage} />
            </>
          )}
        </QueryContent>
      </section>
    </>
  );
}
