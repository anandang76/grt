import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card center auth">
      <h1>Page not found</h1>
      <p className="sub">The page you are looking for does not exist.</p>
      <Link className="btn btn-line" to="/">Go home</Link>
    </div>
  );
}
