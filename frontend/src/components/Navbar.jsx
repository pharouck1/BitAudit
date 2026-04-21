import { useState } from 'react';
import { NavLink } from 'react-router-dom';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="brand">
        <NavLink to="/" end className="brand-mark" onClick={closeMenu}>BitAudit Forensics</NavLink>
        <span className="brand-text">Crypto Recovery & Scam Defense</span>
      </div>

      <button
        type="button"
        className="menu-toggle"
        onClick={handleMenuToggle}
        aria-expanded={isMenuOpen}
        aria-controls="primary-navigation"
        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id="primary-navigation" className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
        <NavLink to="/" end className="button-link" onClick={closeMenu}>Home</NavLink>
        <NavLink to="/recovery" className="button-link" onClick={closeMenu}>Recovery</NavLink>
        <NavLink to="/resources" className="button-link" onClick={closeMenu}>Resources</NavLink>
        <NavLink to="/about" className="button-link" onClick={closeMenu}>About</NavLink>
        <NavLink to="/contact" className="button-link" onClick={closeMenu}>Contact</NavLink>
        <NavLink to="/report" className="button-link" onClick={closeMenu}>Report</NavLink>
      </nav>
    </header>
  );
}

export default Navbar;
