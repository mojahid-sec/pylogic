import { SlidersHorizontal } from 'lucide-react';
import type { LanguageCode, SectionId } from '../types/pylogic';
import { getTranslations } from '../utils/language';
import { NAVIGATION_ITEMS } from '../utils/navigation';

interface TopBarProps {
  activeSection: SectionId;
  isNotFound?: boolean;
  language: LanguageCode;
  onOpenSettings: () => void;
}

export function TopBar({
  activeSection,
  isNotFound = false,
  language,
  onOpenSettings,
}: TopBarProps) {
  const t = getTranslations(language);
  const currentItem = NAVIGATION_ITEMS.find((item) => item.id === activeSection);

  return (
    <div className="hidden lg:flex items-center justify-between gap-8 pb-6 mb-8 border-b surface-divider">
      <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] min-w-0">
        <span className="font-medium text-[var(--text-primary)] whitespace-nowrap">
          {t.brand.name}
        </span>
        <span aria-hidden="true">/</span>
        {isNotFound ? (
          <span className="whitespace-nowrap">{t.notFound.heading}</span>
        ) : (
          currentItem && (
            <>
              <span className="whitespace-nowrap">{t.nav[currentItem.labelKey]}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{t.nav[currentItem.subtitleKey]}</span>
            </>
          )
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {activeSection !== 'settings' && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal
              className="w-3.5 h-3.5 text-[var(--text-secondary)]"
              aria-hidden="true"
            />
            <span>{t.nav.settings}</span>
          </button>
        )}
      </div>
    </div>
  );
}
