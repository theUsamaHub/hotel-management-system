import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { accountDestination } from '../utils/auth.js';

export default function GuestLink({ to, ...props }) {
  const auth = useContext(AuthContext);
  return <Link to={accountDestination(auth?.user, to)} {...props} />;
}
