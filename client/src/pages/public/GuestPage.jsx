import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  Coffee,
  CalendarDays,
  ReceiptText,
  Heart,
  MapPin,
} from 'lucide-react';
export function GuestHero({ eyebrow, title, description, children }) {
  return (
    <section className="guest-hero">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="guest-intro">{description}</p>
        {children}
      </div>
      <div
        className="stay-visual"
        role="img"
        aria-label="Architectural illustration of a tranquil hotel courtyard"
      >
        <div className="stay-sun" />
        <div className="stay-building">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="stay-pool" />
        <span>A little space. A different pace.</span>
      </div>
    </section>
  );
}
export function GuestCTA() {
  return (
    <section className="guest-cta">
      <div>
        <p className="eyebrow">Your next chapter</p>
        <h2>Make room for a memorable stay.</h2>
        <p>Create your account to explore live availability and plan your visit.</p>
      </div>
      <Link className="button" to="/register">
        Start your journey <ArrowRight size={16} />
      </Link>
    </section>
  );
}
export const features = [
  [BedDouble, 'Find your space', 'Compare available rooms, capacity and prices for your dates.'],
  [
    Coffee,
    'Make it your stay',
    'Explore the services offered by your hotel and request them from your account.',
  ],
  [
    ReceiptText,
    'Keep everything together',
    'Review your reservations, itemized bills and recorded payments in one place.',
  ],
];
export function FeatureGrid() {
  return (
    <div className="guest-feature-grid">
      {features.map(([Icon, title, text]) => (
        <article className="card" key={title}>
          <Icon size={25} />
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}
export default function GuestPage({ page }) {
  const content = {
    stays: [
      'Rooms & stays',
      'Find somewhere to slow down.',
      'Choose your hotel, explore available rooms and find the space that fits your plans.',
    ],
    about: [
      'About LuxuryStay',
      'Thoughtful hospitality. Connected details.',
      'LuxuryStay brings the guest journey and the hotel team together, from the first reservation to the final farewell.',
    ],
    services: [
      'During your stay',
      'The little things make the difference.',
      'Your guest account connects you to the services available at your selected hotel.',
    ],
    help: [
      'Guest guide',
      'A smoother stay starts here.',
      'Answers to the practical questions, with your hotel team close at hand.',
    ],
    contact: [
      'Contact & support',
      'Let’s make your stay easier.',
      'Find the right hotel contact and keep your stay details close by.',
    ],
  }[page];
  return (
    <main className="guest-site">
      <GuestHero eyebrow={content[0]} title={content[1]} description={content[2]}>
        <div className="linear-actions">
          <Link className="button" to="/user/operations">
            {page === 'contact' ? 'Find your hotel' : 'Explore availability'}{' '}
            <ArrowRight size={16} />
          </Link>
          <Link className="button secondary" to="/login">
            Guest sign in
          </Link>
        </div>
      </GuestHero>
      {page === 'stays' && (
        <>
          <section className="guest-section">
            <p className="eyebrow">A stay that suits you</p>
            <h2>Your dates. Your space. Your choice.</h2>
            <FeatureGrid />
            <p className="muted">
              Room categories, amenities, rates and availability vary by property. Sign in to view
              current hotel inventory and booking terms.
            </p>
          </section>
          <section className="guest-section guest-split">
            <h2>
              From planning to arriving,
              <br />
              everything in one place.
            </h2>
            <ol className="guest-steps">
              <li>Select your hotel and travel dates.</li>
              <li>Choose an available room and review its policy.</li>
              <li>Submit your reservation and follow its confirmation.</li>
            </ol>
          </section>
        </>
      )}
      {page === 'about' && (
        <>
          <section className="guest-section guest-split">
            <div>
              <p className="eyebrow">Our approach</p>
              <h2>
                More attention to the stay.
                <br />
                Less time on the details.
              </h2>
            </div>
            <div>
              <p>
                A great visit depends on the small things working together. LuxuryStay connects
                reservations, reception, housekeeping and guest services so the right team can take
                care of the next step.
              </p>
              <p>
                For guests, that means one account to manage bookings, request services, review
                bills and share feedback after a stay.
              </p>
            </div>
          </section>
          <FeatureGrid />
        </>
      )}
      {page === 'services' && (
        <section className="guest-section">
          <h2>Comfort, on your terms.</h2>
          <div className="guest-feature-grid">
            {[
              [
                Coffee,
                'Food & refreshments',
                'Explore the room-service options your property offers.',
              ],
              [
                Heart,
                'Everyday conveniences',
                'Request available laundry, transport or other hotel services.',
              ],
              [
                CalendarDays,
                'Stay support',
                'Keep track of requests and report room issues during an active stay.',
              ],
            ].map(([Icon, title, text]) => (
              <article className="card" key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <p className="muted">
            Examples are illustrative. Each property sets its own service catalog, availability and
            charges. Billable completed services appear on your bill.
          </p>
          <Link className="button secondary" to="/user/services">
            Open my guest services
          </Link>
        </section>
      )}
      {page === 'help' && (
        <section className="guest-section guest-faq">
          <h2>Before, during and after.</h2>
          {[
            [
              'How do I book?',
              'Create an account, add your guest profile, choose a hotel and search for available rooms. A submitted reservation is pending until staff confirms it.',
            ],
            [
              'Can I change or cancel a booking?',
              'Changes and cancellations follow the policy saved with your reservation. If the self-service deadline has passed, contact reception.',
            ],
            [
              'How do payments work?',
              'Hotel staff record external payments and provide an itemized invoice. The website does not process online card payments.',
            ],
            [
              'How do I request a service?',
              'During an active stay, open Guest services in your account. Available services and prices depend on your hotel.',
            ],
            [
              'Where do I find check-in times?',
              'Check the saved terms on your reservation. Times shown in the current system use UTC. Contact reception if you need help planning your arrival.',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      )}
      {page === 'contact' && (
        <section className="guest-section guest-feature-grid">
          <article className="card">
            <MapPin />
            <h2>Your hotel team</h2>
            <p>
              Sign in and select your hotel to see its contact details. Reception can help with
              arrival arrangements and booking-policy exceptions.
            </p>
            <Link to="/user/operations" className="button secondary">
              View hotel details
            </Link>
          </article>
          <article className="card">
            <CalendarDays />
            <h2>An existing booking?</h2>
            <p>
              Keep your booking reference ready when contacting reception. You can find it in your
              reservations.
            </p>
            <Link to="/user/reservations" className="button secondary">
              My reservations
            </Link>
          </article>
          <article className="card">
            <Heart />
            <h2>Help during your stay</h2>
            <p>
              Report a room issue or request an available service directly from your active stay.
            </p>
            <Link to="/user/services" className="button secondary">
              Guest services
            </Link>
          </article>
        </section>
      )}
      <GuestCTA />
    </main>
  );
}
