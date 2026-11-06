import { Link } from 'react-router-dom';
import { Layers3, ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="navbar">
      <Link className="brand" to="/">
        <span className="brand-mark">
          <Layers3 size={22} />
        </span>
        LuxuryStay<span className="brand-dot">®</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link to="/login">Sign in</Link>
        <Link className="button small" to="/register">
          Get started <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
