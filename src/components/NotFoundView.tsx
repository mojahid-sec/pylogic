import { ArrowLeft } from 'lucide-react';
import type { LanguageCode, SectionId } from '../types/pylogic';
import { getTranslations } from '../utils/language';

interface NotFoundViewProps {
  language: LanguageCode;
  requestedRoute: string;
  onNavigate: (section: SectionId) => void;
}

export function NotFoundView({
  language,
  requestedRoute,
  onNavigate,
}: NotFoundViewProps) {
  const t = getTranslations(language);

  return (
    <section className="view-enter surface-card rounded-lg p-8 sm:p-10 max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-code text-[var(--text-secondary)]">
          {t.notFound.kicker}
        </p>
        <h1 className="mt-2 font-editorial text-3xl font-normal tracking-[-0.02em] text-[var(--text-primary)]">
          {t.notFound.heading}
        </h1>
        <p className="mt-3 text-sm sm:text-[15px] text-[var(--text-secondary)] leading-relaxed">
          {t.notFound.body}
        </p>
        {requestedRoute && (
          <p className="mt-3 text-xs font-code text-[var(--text-muted)]">
            {t.notFound.requestedPrefix}: {requestedRoute}
          </p>
        )}
      </div>

      <div className="pt-4 border-t surface-divider flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-md btn-primary whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.notFound.backDashboard}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('logic-building')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
        >
          <span>{t.notFound.openCurriculum}</span>
        </button>
      </div>
    </section>
  );
}
