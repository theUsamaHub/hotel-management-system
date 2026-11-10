import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderOpen } from 'lucide-react';
import useAuth from '../../hooks/useAuth.js';
import { useCategories } from '../../hooks/useCategories.js';
import CategoryCard from '../../components/CategoryCard.jsx';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import MediaLibrary from '../../components/MediaLibrary.jsx';

function StaffDashboard() {
  const { user } = useAuth();
  const query = useCategories({ limit: 3, isActive: true });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A fresh perspective</p>
          <h1>
            Hello, {user.name.split(' ')[0]} <span className="wave">✳</span>
          </h1>
          <p>Your space to discover, explore, and stay connected.</p>
        </div>
        <Link className="button" to="/user/categories">
          Explore categories <ArrowUpRight size={17} />
        </Link>
      </div>
      <section className="workspace-banner">
        <div>
          <p className="eyebrow">Curated for your curiosity</p>
          <h2>
            Find a little inspiration.
            <br />
            Discover something new.
          </h2>
          <p>
            {query.data
              ? `${query.data.pagination.total} active categories are ready to explore.`
              : 'Your categories, together in one place.'}
          </p>
        </div>
        <div className="banner-orbit">
          <FolderOpen size={62} strokeWidth={1} />
        </div>
      </section>
      <div className="section-label">
        <h2>Recently added</h2>
        <Link to="/user/categories" className="text-sm">
          Browse all ↗
        </Link>
      </div>
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.categories.length ? (
        <div className="category-grid">
          {query.data.categories.map((category) => (
            <CategoryCard key={category._id} category={category} />
          ))}
        </div>
      ) : (
        <div className="card empty">There are no active categories yet. Check back soon.</div>
      )}
      <div className="section-label media-section-heading">
        <h2>Shared media</h2>
        <Link to="/user/media">Browse all ↗</Link>
      </div>
      <MediaLibrary compact />
    </>
  );
}

export default function UserDashboard() {
  const { user } = useAuth();
  if (user.role !== 'user') return <StaffDashboard />;
  return (
    <>
      <section className="guest-account-hero">
        <p className="eyebrow">Your Luxury Star Hotel</p>
        <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
        <p>Your next stay, and every detail that comes with it.</p>
        <Link className="button" to="/user/operations">
          Find a room <ArrowUpRight size={16} />
        </Link>
      </section>
      <div className="guest-feature-grid">
        {[
          ['reservations', 'My reservations', 'Follow, change or cancel your bookings.'],
          ['stays', 'My stays', 'View arrival, departure and room details.'],
          ['services', 'Guest services', 'Request available services during your stay.'],
          ['billing', 'My invoices', 'Review charges, payments and invoices.'],
          ['feedback', 'My feedback', 'Share your experience after your stay.'],
          ['profile', 'My account', 'Keep your contact and security details up to date.'],
        ].map(([path, title, text]) => (
          <Link className="card guest-account-card" key={path} to={`/user/${path}`}>
            <h2>{title}</h2>
            <p>{text}</p>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </div>
    </>
  );
}
