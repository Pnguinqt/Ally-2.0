import React, { useMemo } from 'react';
import { RotateCcw, Search, SlidersHorizontal, UsersRound } from 'lucide-react';
import { LawyerCard } from './LawyerCard';

const selectClassName = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

export const SearchPanel = ({
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
  lawyers,
  filterOptions = [],
  onLawyerSelect,
  totalLawyers
}) => {
  const specializations = useMemo(() => [...new Set(
    filterOptions.flatMap(lawyer => String(lawyer.specialty || '')
      .split(',')
      .map(value => value.trim())
      .filter(value => value && value !== 'Not specified'))
  )].sort(), [filterOptions]);

  const locations = useMemo(() => [...new Set(
    filterOptions.map(lawyer => lawyer.location).filter(Boolean)
  )].sort(), [filterOptions]);

  const activeFilterCount = [
    filters.specialty !== 'All Specialties',
    Boolean(filters.location && filters.location !== 'All Locations'),
    filters.experience !== 'All Years',
    filters.casesHandled !== 'All Cases'
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearchQuery('');
    setFilters({
      specialty: 'All Specialties',
      location: 'All Locations',
      experience: 'All Years',
      availability: 'Any Day',
      casesHandled: 'All Cases',
      rating: 'Any Rating'
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by lawyer, specialty, or location"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:text-base"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              aria-label="Search lawyers"
            />
          </div>

          <div className="flex items-center justify-between gap-3 xl:justify-end">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              {totalLawyers} match{totalLawyers === 1 ? '' : 'es'}
            </div>
            {(activeFilterCount > 0 || searchQuery) && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" aria-hidden="true" />
            Refine results
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">{activeFilterCount}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Specialty
              <select
                className={selectClassName}
                value={filters.specialty}
                onChange={event => setFilters({ ...filters, specialty: event.target.value })}
              >
                <option value="All Specialties">All specialties</option>
                {specializations.map(specialty => <option key={specialty} value={specialty}>{specialty}</option>)}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location
              <select
                className={selectClassName}
                value={filters.location || 'All Locations'}
                onChange={event => setFilters({ ...filters, location: event.target.value })}
              >
                <option value="All Locations">All locations</option>
                {locations.map(location => <option key={location} value={location}>{location}</option>)}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Experience
              <select
                className={selectClassName}
                value={filters.experience || 'All Years'}
                onChange={event => setFilters({ ...filters, experience: event.target.value })}
              >
                <option value="All Years">Any experience</option>
                <option value="1-3">1–3 years</option>
                <option value="4-7">4–7 years</option>
                <option value="8+">8+ years</option>
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cases handled
              <select
                className={selectClassName}
                value={filters.casesHandled || 'All Cases'}
                onChange={event => setFilters({ ...filters, casesHandled: event.target.value })}
              >
                <option value="All Cases">Any number</option>
                <option value="1-10">1–10 cases</option>
                <option value="11-50">11–50 cases</option>
                <option value="51+">51+ cases</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {lawyers.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-6 w-6 text-slate-500" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">No matching lawyers found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Try a broader search or clear your filters to view all verified lawyers.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            View all lawyers
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {lawyers.map(lawyer => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} onClick={onLawyerSelect} />
          ))}
        </div>
      )}
    </div>
  );
};
