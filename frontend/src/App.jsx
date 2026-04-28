import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Recovery from './pages/Recovery.jsx';
import About from './pages/About.jsx';
import Resources from './pages/Resources.jsx';
import Contact from './pages/Contact.jsx';
import PlatformForm from './pages/PlatformForm.jsx';
import AdminSubmissions from './pages/AdminSubmissions.jsx';

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    const pageTitles = {
      '/': 'Home',
      '/recovery': 'Recovery',
      '/about': 'About',
      '/resources': 'Resources',
      '/contact': 'Contact',
      '/report': 'Report Incident',
      '/admin/submissions': 'Admin Submissions',
    };

    const currentPage = pageTitles[location.pathname] || 'Home';
    document.title = `${currentPage} | BitAudit Forensics`;
  }, [location.pathname]);

  useEffect(() => {
    const floatingNodes = document.querySelectorAll(
      '.page-section, .hero-card, .feature-grid article, .faq-grid article, .info-block, .report-form label, .form-message'
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    floatingNodes.forEach((node) => {
      node.classList.add('float-surface');
      observer.observe(node);
    });

    return () => {
      floatingNodes.forEach((node) => observer.unobserve(node));
      observer.disconnect();
    };
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recovery" element={<Recovery />} />
          <Route path="/about" element={<About />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/report" element={<PlatformForm />} />
          <Route path="/admin/submissions" element={<AdminSubmissions />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
