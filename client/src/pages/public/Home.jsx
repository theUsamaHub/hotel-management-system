import GuestLink from '../../components/GuestLink.jsx';

import { ArrowRight, ArrowDown } from 'lucide-react';
import { GuestCTA } from './GuestPage.jsx';
export default function Home() {
  return (
    <main className="editorial-home">
      <section className="destination-hero">
        <div className="destination-copy">
          <p className="eyebrow">
            MORE THAN A ROOM
            <br />A STAY THAT IS YOURS
          </p>
          <h1>
            A slower pace.
            <br />A brighter
            <br />
            <em>stay.</em>
          </h1>
          <p>
            Find your room. Make your plans.
            <br />
            Let the details fall into place.
          </p>
          <GuestLink className="button" to="/user/operations">
            Plan your stay <ArrowRight size={18} />
          </GuestLink>
        </div>
        <div className="hero-bottom">
          <span>DISCOVER · STAY · CONNECT</span>
          <a href="#experience" aria-label="Explore the guest experience">
            <ArrowDown />
          </a>
        </div>
      </section>
      <div className="destination-title">
        <span>LUXURY STAR</span>
        <p>THOUGHTFUL STAYS. CONNECTED HOSPITALITY.</p>
        <small>Coastal atmosphere artwork · Explore actual availability in your account</small>
      </div>
      <div className="guest-site">
        <section className="editorial-discovery" id="experience">
          <div>
            <p className="eyebrow">THE ART OF A SIMPLE STAY</p>
            <h2>
              More room
              <br />
              for your time.
            </h2>
            <p>
              From choosing a room to your final invoice, Luxury Star Hotel brings your hotel and your
              plans together. A personal space for the practical details, so you can enjoy the
              visit.
            </p>
            <GuestLink className="editorial-link" to="/about">
              Discover Luxury Star Hotel <ArrowRight size={17} />
            </GuestLink>
          </div>
          <figure className="discovery-image">
            <img
              src="/images/quiet-suite.png"
              alt="Illustrative sunlit guest suite with linen furnishings"
              loading="lazy"
            />
            <figcaption>
              FIND YOUR SPACE <span>A room for your plans</span>
            </figcaption>
          </figure>
          <figure className="discovery-image secondary">
            <img
              src="/images/coastal-retreat.png"
              alt="Illustrative terrace overlooking the coast"
              loading="lazy"
            />
            <figcaption>
              TAKE YOUR TIME <span>A different pace</span>
            </figcaption>
          </figure>
        </section>
        <section className="guest-section">
          <div className="guest-section-heading">
            <div>
              <p className="eyebrow">YOUR STAY, FROM START TO FINISH</p>
              <h2>
                Less to organise.
                <br />
                More to look forward to.
              </h2>
            </div>
            <GuestLink className="editorial-link" to="/features">
              All guest features <ArrowRight size={17} />
            </GuestLink>
          </div>
          <div className="journey-grid">
            {[
              [
                '01',
                'Before you arrive',
                'Create an account, select a hotel and save your guest profile. Search dates and guest count, choose a room and submit your booking for staff confirmation.',
                '/stays',
                'Find your room',
              ],
              [
                '02',
                'While you are here',
                'Follow your stay, request available hotel services and report room issues. See request progress and keep track of your itemized bill.',
                '/services',
                'Explore guest services',
              ],
              [
                '03',
                'Until next time',
                'Reception settles your balance and completes checkout. Access your final invoice and leave a rating and comment about your stay.',
                '/help',
                'Read the guest guide',
              ],
            ].map(([number, title, text, to, label]) => (
              <article key={number}>
                <span className="journey-number">{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <GuestLink className="editorial-link" to={to}>
                  {label}
                  <ArrowRight size={16} />
                </GuestLink>
              </article>
            ))}
          </div>
        </section>
        <section className="guest-section guest-split editorial-note">
          <div>
            <p className="eyebrow">EVERY DETAIL IN ONE ACCOUNT</p>
            <h2>
              Your plans.
              <br />
              Always close by.
            </h2>
          </div>
          <div>
            <p>
              Manage reservations, read hotel policies, receive in-app updates, review recorded
              payments and find your hotel’s contact details. Your account follows the whole
              journey.
            </p>
            <p>
              Bookings are confirmed by the hotel team. Payments are collected externally and
              recorded by reception; the website does not charge your card online.
            </p>
            <GuestLink className="editorial-link" to="/features">
              See what your account can do <ArrowRight size={17} />
            </GuestLink>
          </div>
        </section>
        <GuestCTA />
      </div>
    </main>
  );
}
