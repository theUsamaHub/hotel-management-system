import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import useAuth from '../../hooks/useAuth.js';
import { all, get, money, Field, QueryContent, History, useSave } from './shared.jsx';

function InvoiceSheet({ bill }) {
  return (
    <article className="hms-invoice">
      <h2>
        {bill.status === 'issued'
          ? 'Invoice'
          : bill.status === 'legacy_settlement'
            ? 'Legacy settlement'
            : 'Draft bill'}
      </h2>
      <h3>{bill.property.name}</h3>
      <p>
        {bill.property.address}, {bill.property.city}, {bill.property.country}
      </p>
      <p>
        {bill.property.email} · {bill.property.phone}
      </p>
      <p>{bill.number || 'Final invoice number assigned at checkout'}</p>
      <p>
        Guest: {bill.guest.name} · {bill.guest.email}
      </p>
      <p>Booking: {bill.bookingReference}</p>
      {bill.issuedAt && <p>Issued: {new Date(bill.issuedAt).toLocaleString()}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((line, i) => (
              <tr key={line._id || i}>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>{money(line.unitAmount, bill.currency)}</td>
                <td>{money(line.total, bill.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="hms-totals">
        <dt>Subtotal</dt>
        <dd>{money(bill.subtotal, bill.currency)}</dd>
        <dt>Discount{bill.discountReason ? ` · ${bill.discountReason}` : ''}</dt>
        <dd>{money(bill.discount, bill.currency)}</dd>
        <dt>Tax ({bill.taxBps / 100}%)</dt>
        <dd>{money(bill.tax, bill.currency)}</dd>
        <dt>Total</dt>
        <dd>{money(bill.total, bill.currency)}</dd>
        <dt>Recorded payments</dt>
        <dd>{money(bill.paid, bill.currency)}</dd>
        <dt>Outstanding balance</dt>
        <dd>{money(bill.balance, bill.currency)}</dd>
      </dl>
      <p>
        {bill.status === 'draft'
          ? 'Draft: charges and overdue nights may change until checkout.'
          : 'Issued account record. Payments were recorded by hotel staff; no online card charge was processed by this app.'}
      </p>
    </article>
  );
}
function BillPanel({ id, role }) {
  const canCollect = ['admin', 'manager', 'receptionist'].includes(role);
  const manager = ['admin', 'manager'].includes(role);
  const query = useQuery({ queryKey: ['hms', 'bill', id], queryFn: () => get(`stays/${id}/bill`) });
  const [form, setForm] = useState(null);
  const [mode, setMode] = useState(null);
  const [history, setHistory] = useState(false);
  const save = useSave(
    () => {
      const version = form.version;
      if (mode === 'charge')
        return api.post(`/hms/stays/${id}/charges`, {
          version,
          description: form.description,
          quantity: Number(form.quantity),
          unitAmount: Math.round(Number(form.price) * 100),
        });
      if (mode === 'payment')
        return api.post(`/hms/stays/${id}/payments`, {
          version,
          amount: Math.round(Number(form.amount) * 100),
          method: form.method,
          reference: form.reference,
        });
      if (mode === 'void')
        return api.post(`/hms/stays/${id}/charges/${form.chargeId}/void`, {
          version,
          reason: form.reason,
        });
      return api.put(`/hms/stays/${id}/bill`, {
        version,
        discount: Math.round(Number(form.discount) * 100),
        taxBps: Math.round(Number(form.tax) * 100),
        discountReason: form.reason,
      });
    },
    () => setForm(null),
  );
  const email = useSave(() => api.post(`/hms/stays/${id}/invoice/email`, {}));
  const change = (name, value) => setForm({ ...form, [name]: value });
  function edit(kind, values) {
    setMode(kind);
    setForm({ ...values, version: query.data.bill.version });
  }
  return (
    <QueryContent query={query}>
      {({ bill, stay }) => (
        <>
          <section className="card hms-form">
            <div className="toolbar">
              <button className="button secondary" onClick={() => window.print()}>
                Print bill / invoice
              </button>
              {bill.status === 'issued' && (
                <button
                  className="button secondary"
                  disabled={email.isPending}
                  onClick={() => email.mutate()}
                >
                  Email invoice
                </button>
              )}
              <button className="button secondary" onClick={() => setHistory(!history)}>
                Billing history
              </button>
            </div>
            <InvoiceSheet bill={bill} />
            {createPortal(
              <div className="hms-print-root">
                <InvoiceSheet bill={bill} />
              </div>,
              document.body,
            )}
          </section>
          {canCollect && stay.status === 'active' && (
            <section className="card hms-form">
              <h3>Manage charges and payments</h3>
              <p>
                Record money collected outside this app. Final invoices are issued at checkout after
                service requests and the balance are resolved. Adjustments after payment cannot
                create an overpaid account.
              </p>
              <div className="toolbar">
                <button
                  className="button"
                  disabled={save.isPending}
                  onClick={() => edit('charge', { description: '', quantity: 1, price: '' })}
                >
                  Add charge
                </button>
                <button
                  className="button"
                  disabled={save.isPending || bill.balance <= 0}
                  onClick={() =>
                    edit('payment', { amount: bill.balance / 100, method: 'cash', reference: '' })
                  }
                >
                  Record payment
                </button>
                {manager && (
                  <button
                    className="button secondary"
                    disabled={save.isPending}
                    onClick={() =>
                      edit('adjust', {
                        discount: bill.discount / 100,
                        tax: bill.taxBps / 100,
                        reason: bill.discountReason,
                      })
                    }
                  >
                    Tax / discount
                  </button>
                )}
              </div>
            </section>
          )}
          {form && (
            <section className="card hms-form">
              <h3>
                {
                  {
                    charge: 'Add billable charge',
                    payment: 'Record external payment',
                    adjust: 'Authorized bill adjustment',
                    void: 'Void charge',
                  }[mode]
                }
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <fieldset className="hms-fields" disabled={save.isPending}>
                  {mode === 'charge' && (
                    <>
                      <Field
                        label="Charge description"
                        name="description"
                        value={form.description}
                        change={change}
                        maxLength={300}
                      />
                      <Field
                        label="Charge quantity"
                        name="quantity"
                        value={form.quantity}
                        change={change}
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                      />
                      <Field
                        label="Unit charge amount"
                        name="price"
                        value={form.price}
                        change={change}
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                      />
                    </>
                  )}
                  {mode === 'payment' && (
                    <>
                      <Field
                        label="Payment amount"
                        name="amount"
                        value={form.amount}
                        change={change}
                        type="number"
                        min="0.01"
                        step="0.01"
                      />
                      <Field
                        label="Payment method"
                        name="method"
                        value={form.method}
                        change={change}
                        options={[
                          ['cash', 'Cash'],
                          ['card', 'External card terminal'],
                          ['bank_transfer', 'Bank transfer'],
                        ]}
                      />
                      <Field
                        label="Unique receipt / payment reference"
                        name="reference"
                        value={form.reference}
                        change={change}
                        maxLength={120}
                      />
                    </>
                  )}
                  {mode === 'adjust' && (
                    <>
                      <Field
                        label="Tax percentage"
                        name="tax"
                        value={form.tax}
                        change={change}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                      <Field
                        label="Discount amount"
                        name="discount"
                        value={form.discount}
                        change={change}
                        type="number"
                        min="0"
                        step="0.01"
                      />
                      <Field
                        label="Discount reason"
                        name="reason"
                        value={form.reason}
                        change={change}
                        maxLength={300}
                        required={Number(form.discount) > 0}
                      />
                    </>
                  )}
                  {mode === 'void' && (
                    <Field
                      label="Void reason"
                      name="reason"
                      value={form.reason}
                      change={change}
                      maxLength={300}
                    />
                  )}
                </fieldset>
                <div className="toolbar">
                  <button className="button" disabled={save.isPending}>
                    Save billing record
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
          {bill.charges?.length > 0 && (
            <section className="card hms-form">
              <h3>Additional charge history</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      {manager && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bill.charges.map((charge) => (
                      <tr key={charge._id}>
                        <td>
                          {charge.description}
                          {charge.voidReason && <p>{charge.voidReason}</p>}
                        </td>
                        <td>{money(charge.total, bill.currency)}</td>
                        <td>{charge.status}</td>
                        {manager && (
                          <td>
                            {stay.status === 'active' && charge.status === 'posted' && (
                              <button
                                className="button secondary small"
                                onClick={() => edit('void', { chargeId: charge._id, reason: '' })}
                              >
                                Void charge
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className="card hms-form">
            <h3>Payment history</h3>
            {!bill.payments.length ? (
              <p>No payment records yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Recorded</th>
                      <th>Reference</th>
                      <th>Method</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.payments.map((payment) => (
                      <tr key={payment._id}>
                        <td>{new Date(payment.createdAt).toLocaleString()}</td>
                        <td>{payment.reference}</td>
                        <td>{payment.method}</td>
                        <td>{money(payment.amount, payment.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {history && (
            <History path={`stays/${id}/billing-history`} close={() => setHistory(false)} />
          )}
        </>
      )}
    </QueryContent>
  );
}
export default function Billing({ hotel }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState('');
  const stays = useQuery({
    queryKey: ['hms', 'billing-stays', hotel],
    queryFn: () => all('stays', 'stays', { hotel }),
  });
  return (
    <>
      <h2>Billing & invoices</h2>
      <QueryContent query={stays}>
        {(rows) =>
          rows.length ? (
            <>
              <section className="card hms-form">
                <Field
                  label="Stay account"
                  name="stay"
                  value={selected || rows[0]._id}
                  change={(_name, value) => setSelected(value)}
                  options={rows.map((stay) => [
                    stay._id,
                    `${stay.reservation.contact.name} · Room ${stay.room.number} · ${stay.reservation.checkIn} · ${stay.status}`,
                  ])}
                />
              </section>
              <BillPanel
                key={selected || rows[0]._id}
                id={selected || rows[0]._id}
                role={user.role}
              />
            </>
          ) : (
            <section className="card empty">No stays available for billing.</section>
          )
        }
      </QueryContent>
    </>
  );
}
