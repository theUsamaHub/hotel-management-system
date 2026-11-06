import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios.js';
import Pagination from '../../components/Pagination.jsx';
import { all, get, Field, QueryContent, useSave } from './shared.jsx';

function FeedbackForm({ hotel }) {
  const [form, setForm] = useState({ stay: '', rating: '5', comment: '' });
  const stays = useQuery({
    queryKey: ['hms', 'reviewable-stays', hotel],
    queryFn: async () => {
      const [rows, feedback] = await Promise.all([
        all('stays', 'stays', { hotel, status: 'completed' }),
        all('feedback', 'feedback', { hotel }),
      ]);
      const reviewed = new Set(feedback.map((review) => review.stay));
      return rows.filter((stay) => !reviewed.has(stay._id));
    },
  });
  const save = useSave(
    () => api.post('/hms/feedback', { ...form, rating: Number(form.rating) }),
    () => setForm({ stay: '', rating: '5', comment: '' }),
  );
  const change = (name, value) => setForm({ ...form, [name]: value });
  return (
    <section className="card hms-form">
      <h3>Review a completed stay</h3>
      <QueryContent query={stays}>
        {(rows) =>
          rows.length ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <fieldset className="hms-fields" disabled={save.isPending}>
                <Field
                  label="Stay to review"
                  name="stay"
                  value={form.stay}
                  change={change}
                  options={[
                    ['', 'Choose completed stay'],
                    ...rows.map((stay) => [
                      stay._id,
                      `Room ${stay.room.number} · ${stay.reservation.checkIn} → ${stay.reservation.checkOut}`,
                    ]),
                  ]}
                />
                <Field
                  label="Stay rating"
                  name="rating"
                  value={form.rating}
                  change={change}
                  options={[5, 4, 3, 2, 1].map((v) => [String(v), `${v} / 5`])}
                />
                <Field
                  label="Feedback comment"
                  name="comment"
                  value={form.comment}
                  change={change}
                  maxLength={2000}
                />
              </fieldset>
              <button className="button" disabled={save.isPending}>
                Submit feedback
              </button>
            </form>
          ) : (
            <p>No completed stays awaiting your feedback.</p>
          )
        }
      </QueryContent>
    </section>
  );
}
export default function Feedback({ hotel, isGuest }) {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState('');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['hms', 'feedback', hotel, page, rating, search],
    queryFn: () =>
      get('feedback', { hotel, page, limit: 10, search, ...(rating ? { rating } : {}) }),
  });
  return (
    <>
      <h2>{isGuest ? 'My feedback' : 'Guest feedback'}</h2>
      {isGuest && <FeedbackForm hotel={hotel} />}
      <div className="hms-fields">
        <Field
          label="Filter rating"
          name="rating"
          value={rating}
          change={(_name, value) => {
            setRating(value);
            setPage(1);
          }}
          options={[['', 'All ratings'], ...[5, 4, 3, 2, 1].map((v) => [String(v), `${v} / 5`])]}
        />
        <Field
          label="Search feedback"
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
      <section className="card hms-form">
        <QueryContent query={query}>
          {(data) => (
            <>
              <p>
                {data.summary.total} matching reviews · Average {data.summary.average.toFixed(1)} /
                5
              </p>
              {data.feedback.map((review) => (
                <article className="hms-history" key={review._id}>
                  <strong>
                    {review.rating} / 5 · {review.guest?.name || 'Guest'}
                  </strong>
                  <p>{review.comment}</p>
                  <small>{new Date(review.createdAt).toLocaleString()}</small>
                </article>
              ))}
              {!data.feedback.length && <p>No feedback matches these filters.</p>}
              <Pagination pagination={data.pagination} onPageChange={setPage} />
            </>
          )}
        </QueryContent>
      </section>
    </>
  );
}
