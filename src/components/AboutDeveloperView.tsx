import { ArrowUpRight } from 'lucide-react';
import developerPhoto from '../assets/developer/profile.jpeg';
import type { LanguageCode } from '../types/pylogic';
import { getTranslations, pickText } from '../utils/language';
import { curriculumData, formatTwoDigits } from '../utils/progress';
import { isSafeHttpUrl } from '../utils/url';

interface AboutDeveloperViewProps {
  language: LanguageCode;
}

export function AboutDeveloperView({ language }: AboutDeveloperViewProps) {
  const t = getTranslations(language);
  const dev = curriculumData.developer;

  return (
    <div className="view-enter space-y-10">
      {/* Section Header */}
      <section className="max-w-3xl">
        <p className="text-xs font-code text-[var(--text-secondary)]">
          {t.developer.kicker}
        </p>
        <h1 className="mt-2 font-editorial text-3xl sm:text-4xl font-normal tracking-[-0.02em] text-[var(--text-primary)]">
          {t.developer.heading}
        </h1>
      </section>

      {/* Main Editorial Two-Column Developer Profile */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Permanent Untouched Original Photograph */}
        <div className="lg:col-span-5 surface-card rounded-lg p-5 sm:p-6">
          <div className="aspect-[3/4] w-full overflow-hidden rounded bg-[var(--bg-subtle)] border surface-divider">
            <img
              src={developerPhoto}
              alt={t.developer.portraitAlt}
              width={1362}
              height={1600}
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-top"
            />
          </div>

          <p className="mt-4 pt-3.5 border-t surface-divider text-[11px] text-[var(--text-muted)] leading-relaxed">
            {t.developer.photoNote}
          </p>
        </div>

        {/* Right: Identity, Education, Introduction, Interests, GitHub */}
        <div className="lg:col-span-7 surface-card rounded-lg p-6 sm:p-8 space-y-8">
          {/* Identity Header */}
          <div className="pb-6 border-b surface-divider">
            <p className="text-xs font-code text-[var(--text-secondary)]">
              {pickText(dev.role, language)}
            </p>
            <h2 className="mt-2 font-editorial text-2xl sm:text-3xl font-normal tracking-tight text-[var(--text-primary)]">
              {pickText(dev.name, language)}
            </h2>
          </div>

          {/* Developer Introduction */}
          <div>
            <h3 className="text-xs font-code text-[var(--text-secondary)]">
              {t.developer.introHeading}
            </h3>
            <p className="mt-3 text-[15px] text-[var(--text-primary)] leading-relaxed">
              {pickText(dev.introduction, language)}
            </p>
            <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
              {pickText(dev.vision, language)}
            </p>
          </div>

          {/* Educational Information */}
          <div className="pt-6 border-t surface-divider">
            <h3 className="text-xs font-code text-[var(--text-secondary)]">
              {t.developer.educationHeading}
            </h3>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <dt className="text-xs text-[var(--text-muted)]">
                  {t.developer.departmentLabel}
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {pickText(dev.department, language)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-muted)]">
                  {t.developer.instituteLabel}
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {pickText(dev.institute, language)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Technology Interests */}
          <div className="pt-6 border-t surface-divider">
            <h3 className="text-xs font-code text-[var(--text-secondary)]">
              {t.developer.interestsHeading}
            </h3>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {dev.interests.map((interest, index) => (
                <li
                  key={interest.en}
                  className="text-sm text-[var(--text-primary)] flex items-baseline gap-3"
                >
                  <span className="font-code text-xs text-[var(--text-muted)]">
                    {formatTwoDigits(index + 1)}
                  </span>
                  <span>{pickText(interest, language)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* GitHub Profile */}
          <div className="pt-6 border-t surface-divider flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-code text-[var(--text-secondary)]">
                {t.developer.githubHeading}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--text-primary)] font-code">
                {t.developer.githubHandleLabel}: {dev.githubUsername}
              </p>
            </div>

            {isSafeHttpUrl(dev.githubUrl) && (
              <a
                href={dev.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-md btn-primary whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <span>{t.developer.visitGithub}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
