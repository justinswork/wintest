import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Navbar() {
  const { t } = useTranslation();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <NavLink to="/">{t('nav.brand')}</NavLink>
      </div>
      <div className="navbar-links">
        <NavLink to="/" end>{t('nav.dashboard')}</NavLink>
        <NavLink to="/tests/new">{t('nav.newTest')}</NavLink>
        <NavLink to="/test-suites/new">{t('nav.newTestSuite')}</NavLink>
        <NavLink to="/execution">{t('nav.execution')}</NavLink>
        <NavLink to="/reports">{t('nav.reports')}</NavLink>
        <NavLink to="/settings">{t('nav.settings')}</NavLink>
        <NavLink to="/help">{t('nav.help')}</NavLink>
      </div>
    </nav>
  );
}
