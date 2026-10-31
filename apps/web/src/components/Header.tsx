import { Link, NavLink } from "react-router-dom";

export function Header() {
  return (
    <header className="header">
      <Link to="/" className="brand">
        <span className="brand-mark" />
        <span>Disha</span>
      </Link>
      <nav className="nav">
        <NavLink to="/" end>Coach</NavLink>
        <NavLink to="/journal">Journal</NavLink>
      </nav>
    </header>
  );
}
