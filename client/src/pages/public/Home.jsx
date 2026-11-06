import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, CalendarDays, ShieldCheck } from 'lucide-react';
export default function Home() {
  return (
    <main className="linear-home">
      <section className="linear-hero">
        <span className="eyebrow">LuxuryStay / Hospitality, connected</span>
        <h1>
          A considered stay.
          <br />
          Every detail connected.
        </h1>
        <p>
          From your first reservation to your final checkout. One place for guests to plan their
          stay and hotel teams to keep everything running.
        </p>
        <div className="linear-actions">
          <Link className="button" to="/register">
            Plan your stay <ArrowRight size={16} />
          </Link>
          <Link className="button secondary" to="/login">
            Sign in to your workspace
          </Link>
        </div>
      </section>
      <section className="linear-preview" aria-label="Example hotel operations preview">
        <div className="linear-preview-header">
          <strong>Hotel operations</strong>
          <span className="muted">Illustrative workspace / Daily overview</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Category</th>
                <th>Room status</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>101</td>
                <td>Deluxe king</td>
                <td>
                  <span className="badge">Ready</span>
                </td>
                <td>Welcome the next arrival</td>
              </tr>
              <tr>
                <td>204</td>
                <td>Garden suite</td>
                <td>
                  <span className="badge">Occupied</span>
                </td>
                <td>Manage guest services</td>
              </tr>
              <tr>
                <td>308</td>
                <td>Premium twin</td>
                <td>
                  <span className="badge">Cleaning</span>
                </td>
                <td>Prepare for check-in</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="linear-features" aria-label="Hotel platform features">
        <article>
          <CalendarDays size={24} />
          <h2>Your stay, simplified.</h2>
          <p>Find available rooms, manage reservations and keep your stay details together.</p>
        </article>
        <article>
          <BedDouble size={24} />
          <h2>Hospitality in sync.</h2>
          <p>Connect the front desk, housekeeping and maintenance through one shared workflow.</p>
        </article>
        <article>
          <ShieldCheck size={24} />
          <h2>Clarity at every step.</h2>
          <p>Review itemized bills, recorded payments and hotel policies in your account.</p>
        </article>
      </section>
    </main>
  );
}
