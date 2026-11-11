import * as React from 'react';

import type { PlatformPrinciple, PlatformStat } from '@/config/services';

export interface PlatformSectionProps {
  principles: readonly PlatformPrinciple[];
  stats: readonly PlatformStat[];
}

/** The dark band that carries the platform guarantees and the verifiable counts. */
export function PlatformSection({ principles, stats }: PlatformSectionProps): React.JSX.Element {
  return (
    <section className="bg-slate-900 text-slate-100">
      <div className="container mx-auto px-4 py-20 lg:py-24">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The foundation under every service line
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Each service line stands on its own, but none of them store their own copy of the truth.
            One isolation model, one permission model and one audit trail run underneath all of
            them.
          </p>
        </div>

        <dl className="mt-14 grid gap-8 border-y border-slate-800 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-sm font-medium text-slate-400">{stat.label}</dt>
              <dd className="mt-2 text-4xl font-bold tracking-tight text-white">{stat.value}</dd>
              <dd className="mt-2 text-sm text-slate-400">{stat.detail}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((principle) => {
            const Icon = principle.icon;

            return (
              <div key={principle.title}>
                <Icon className="size-7 text-brand-300" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-white">{principle.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{principle.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
