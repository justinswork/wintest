import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, FlaskConical, FolderOpen, Hammer, Play, FileText, TrendingUp, Clock, Settings, HelpCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const STORAGE_KEY = 'wintest-sidebar-collapsed';

export function Sidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <nav className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <Link to="/" className="sidebar-brand">{t('nav.brand')}</Link>}
        <button className="btn-icon sidebar-toggle" onClick={toggle} title={collapsed ? t('nav.expand') : t('nav.collapse')}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <div className="sidebar-links">
        <NavLink to="/" end title={collapsed ? t('nav.dashboard') : undefined}><LayoutDashboard size={18} />{!collapsed && <span>{t('nav.dashboard')}</span>}</NavLink>
        <NavLink to="/tests" title={collapsed ? t('nav.tests') : undefined}><FlaskConical size={18} />{!collapsed && <span>{t('nav.tests')}</span>}</NavLink>
        <NavLink to="/test-suites" title={collapsed ? t('nav.testSuites') : undefined}><FolderOpen size={18} />{!collapsed && <span>{t('nav.testSuites')}</span>}</NavLink>
        <NavLink to="/builder" title={collapsed ? t('nav.builder') : undefined}><Hammer size={18} />{!collapsed && <span>{t('nav.builder')}</span>}</NavLink>
        <NavLink to="/execution" title={collapsed ? t('nav.execution') : undefined}><Play size={18} />{!collapsed && <span>{t('nav.execution')}</span>}</NavLink>
        <NavLink to="/reports" title={collapsed ? t('nav.reports') : undefined}><FileText size={18} />{!collapsed && <span>{t('nav.reports')}</span>}</NavLink>
        <NavLink to="/trends" title={collapsed ? t('nav.trends') : undefined}><TrendingUp size={18} />{!collapsed && <span>{t('nav.trends')}</span>}</NavLink>
        <NavLink to="/pipelines" title={collapsed ? t('nav.pipelines') : undefined}><Clock size={18} />{!collapsed && <span>{t('nav.pipelines')}</span>}</NavLink>
      </div>
      <div className="sidebar-links sidebar-links-bottom">
        <NavLink to="/settings" title={collapsed ? t('nav.settings') : undefined}><Settings size={18} />{!collapsed && <span>{t('nav.settings')}</span>}</NavLink>
        <NavLink to="/help" title={collapsed ? t('nav.help') : undefined}><HelpCircle size={18} />{!collapsed && <span>{t('nav.help')}</span>}</NavLink>
      </div>
    </nav>
  );
}
