import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GuestHero, GuestCTA, FeatureGrid } from './GuestPage.jsx';
export default function Home() {
  return (
    <main className="guest-site">
      <GuestHero
        eyebrow="Welcome to LuxuryStay"
        title={
          <>
            Stay a little longer.
            <br />
            Feel a little more at home.
          </>
        }
        description="Space to unwind. Details taken care of. Discover your next stay and keep every part of the journey beautifully simple."
      >
        <div className="linear-actions">
          <Link to="/stays" className="button">
            Discover your stay <ArrowRight size={16} />
          </Link>
          <Link to="/about" className="button secondary">
            Meet LuxuryStay
          </Link>
        </div>
        <p className="hero-footnote">Your reservations, services and stay details. Together.</p>
      </GuestHero>
      <section className="guest-section">
        <div className="guest-section-heading">
          <div>
            <p className="eyebrow">Designed around your visit</p>
            <h2>
              Room for everything
              <br />
              that makes a stay yours.
            </h2>
          </div>
          <Link to="/services">Explore guest services →</Link>
        </div>
        <FeatureGrid />
      </section>
      <section className="guest-section guest-split">
        <div>
          <p className="eyebrow">The LuxuryStay experience</p>
          <h2>
            Arrive with plans.
            <br />
            Leave with memories.
          </h2>
          <p>
            Whether your visit is a quick pause or a longer escape, keep the practical details
            simple. Find your room, follow your booking and connect with your hotel through one
            guest account.
          </p>
          <Link className="button secondary" to="/about">
            Our approach to hospitality
          </Link>
        </div>
        <div className="guest-story card">
          <span className="eyebrow">A connected guest journey</span>
          <ol className="guest-steps">
            <li>
              <strong>Before you arrive</strong>
              <p>Explore availability and review your booking terms.</p>
            </li>
            <li>
              <strong>While you are here</strong>
              <p>Request available services and let the team know what you need.</p>
            </li>
            <li>
              <strong>Until next time</strong>
              <p>Access your invoice and share your experience.</p>
            </li>
          </ol>
        </div>
      </section>
      <section className="guest-section guest-section-heading">
        <div>
          <p className="eyebrow">A little reassurance</p>
          <h2>Questions before you arrive?</h2>
          <p>Our guest guide explains reservations, services, payments and more.</p>
        </div>
        <Link className="button secondary" to="/help">
          Read the guest guide
        </Link>
      </section>
      <GuestCTA />
    </main>
  );
}
