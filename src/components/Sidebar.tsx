import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Code2,
  FolderKanban,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LanguageCode, SectionId } from '../types/pylogic';
import { getTranslations } from '../utils/language';
import { NAVIGATION_ITEMS } from '../utils/navigation';

interface SidebarProps {
  activeSection: SectionId;
  isNotFound?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (section: SectionId) => void;
  language: LanguageCode;
}

const NAV_ICONS: Record<SectionId, LucideIcon> = {
  dashboard: LayoutDashboard,
  'logic-building': Code2,
  projects: FolderKanban,
  'my-progress': BarChart3,
  'about-developer': User,
  settings: Settings,
};

export function Sidebar({
  activeSection,
  isNotFound = false,
  isCollapsed,
  onToggleCollapse,
  onNavigate,
  language,
}: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = getTranslations(language);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleSelectSection = (section: SectionId) => {
    onNavigate(section);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop & Tablet Persistent Collapsible Sidebar (md+) */}
      <aside
        aria-label={t.nav.primaryNavAria}
        data-collapsed={isCollapsed ? 'true' : 'false'}
        className={`hidden md:flex md:flex-col md:shrink-0 md:fixed md:inset-y-0 md:left-0 z-30 border-r surface-divider bg-[var(--bg-card)] transition-[width,background-color,border-color] duration-200 ease-out overflow-visible ${
          isCollapsed ? 'md:w-[72px]' : 'md:w-64'
        }`}
      >
        {/* Fixed-Height Sidebar Header with Top Collapse / Expand Toggle */}
        <div
          className={`h-[88px] shrink-0 border-b surface-divider flex items-center ${
            isCollapsed ? 'justify-center px-3' : 'justify-between gap-3 px-6'
          }`}
        >
          {!isCollapsed && (
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => handleSelectSection('dashboard')}
                className="text-left focus-visible:outline-none"
              >
                <span className="font-editorial text-2xl font-medium tracking-tight text-[var(--text-primary)] block whitespace-nowrap">
                  {t.brand.name}
                </span>
              </button>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)] tracking-wide truncate">
                {t.brand.tagline}
              </p>
            </div>
          )}

          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
              aria-describedby={isCollapsed ? 'sidebar-toggle-tooltip' : undefined}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md btn-secondary text-[var(--text-primary)] shrink-0"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {isCollapsed && (
              <span
                id="sidebar-toggle-tooltip"
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-[var(--accent-contrast)] border surface-divider shadow-sm whitespace-nowrap opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0"
              >
                {t.nav.expandSidebar}
              </span>
            )}
          </div>
        </div>

        {/* Navigation Links (Expanded: Icon + Label | Collapsed: Centered Icon + Tooltip) */}
        <nav className={`flex-1 py-6 space-y-1.5 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
          {NAVIGATION_ITEMS.map((item) => {
            const isActive = !isNotFound && activeSection === item.id;
            const Icon = NAV_ICONS[item.id];
            const label = t.nav[item.labelKey];
            const tooltipId = `nav-tooltip-${item.id}`;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={label}
                  aria-describedby={isCollapsed ? tooltipId : undefined}
                  className={`relative w-full h-10 flex items-center rounded-md transition-colors whitespace-nowrap ${
                    isCollapsed
                      ? 'justify-center px-0'
                      : 'justify-between px-3.5 text-left text-sm'
                  } ${
                    isActive
                      ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-surface)]'
                  }`}
                >
                  {/* Active left bar indicator visible cleanly in collapsed mode */}
                  {isActive && isCollapsed && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-[3px] bg-[var(--accent)] rounded-r"
                    />
                  )}

                  <span
                    className={`flex items-center min-w-0 ${
                      isCollapsed ? 'justify-center' : 'gap-3'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 ${
                        isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                      }`}
                      aria-hidden="true"
                    />
                    {!isCollapsed && <span className="truncate">{label}</span>}
                  </span>

                  {!isCollapsed && isActive && (
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 bg-[var(--accent)] shrink-0"
                    />
                  )}
                </button>

                {/* Hover & Keyboard-Focus Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <span
                    id={tooltipId}
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-[var(--accent-contrast)] border surface-divider shadow-sm whitespace-nowrap opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0"
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer Scope (Hidden when collapsed to prevent text crowding) */}
        <div
          className={`border-t surface-divider transition-opacity duration-150 ${
            isCollapsed ? 'px-2 py-4 text-center' : 'px-6 py-5'
          }`}
        >
          {isCollapsed ? (
            <span
              className="font-code text-[10px] text-[var(--text-muted)] block tabular-nums"
              title={t.brand.scope}
            >
              20·400
            </span>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] font-code leading-relaxed">
              {t.brand.scope}
            </p>
          )}
        </div>
      </aside>

      {/* Mobile Compact Top Header & Drawer (< md) */}
      <header className="md:hidden sticky top-0 z-40 bg-[var(--bg-card)] border-b surface-divider">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <button
            type="button"
            onClick={() => handleSelectSection('dashboard')}
            className="font-editorial text-xl font-medium tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            {t.brand.name}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-[var(--text-primary)] hover:bg-[var(--hover-surface)] transition-colors shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Dropdown Navigation Drawer (Closes after selecting item) */}
        {mobileMenuOpen && (
          <nav
            aria-label={t.nav.mobileNavAria}
            className="border-t surface-divider bg-[var(--bg-card)] px-4 py-3 space-y-1"
          >
            {NAVIGATION_ITEMS.map((item) => {
              const isActive = !isNotFound && activeSection === item.id;
              const Icon = NAV_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-3 text-sm rounded-md text-left min-h-[44px] ${
                    isActive
                      ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{t.nav[item.labelKey]}</span>
                  </span>
                  <span className="text-xs text-[var(--text-muted)] truncate max-w-[140px]">
                    {t.nav[item.subtitleKey]}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </header>
    </>
  );
}
