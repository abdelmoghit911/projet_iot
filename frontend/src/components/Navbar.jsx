import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path ? 'nav-link active fw-bold' : 'nav-link';

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/">
          🚌 SIV Transport
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className={isActive('/')} to="/">
                📍 Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link className={isActive('/fleet')} to="/fleet">
                🚛 Gestion Flotte
              </Link>
            </li>
            <li className="nav-item">
              <Link className={isActive('/history')} to="/history">
                📜 Historique
              </Link>
            </li>
            <li className="nav-item">
              <Link className={isActive('/passenger')} to="/passenger">
                🧑 Voyageur
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
