import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, Scale } from 'lucide-react';

const isVerified = lawyer => Boolean(
  lawyer?.raw?.credentialsVerified ||
  ['approved', 'verified'].includes(String(lawyer?.raw?.status || lawyer?.raw?.verificationStatus || '').toLowerCase())
);

export const LawyerCard = ({ lawyer, onClick }) => {
  const photo = lawyer.profilePhotoUrl || lawyer?.raw?.profilePhotoUrl || lawyer?.raw?.profilePhoto;
  const specialties = String(lawyer.specialty || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-lg font-bold text-white shadow-sm">
            {photo ? (
              <img
                src={photo}
                alt={`${lawyer.name} profile`}
                className="h-full w-full object-cover"
                onError={event => {
                  event.currentTarget.style.display = 'none';
                  event.currentTarget.parentElement.textContent = lawyer.image || 'L';
                }}
              />
            ) : lawyer.image || 'L'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-slate-950">{lawyer.name || 'Unnamed lawyer'}</h2>
              {isVerified(lawyer) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Verified
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{lawyer.location || 'Location not provided'}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex min-h-7 flex-wrap gap-2">
          {specialties.slice(0, 2).map(specialty => (
            <span key={specialty} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {specialty}
            </span>
          ))}
          {specialties.length > 2 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              +{specialties.length - 2} more
            </span>
          )}
          {!specialties.length && <span className="text-sm text-slate-500">General legal practice</span>}
        </div>

        <p className="mt-4 line-clamp-2 min-h-12 text-sm leading-6 text-slate-600">
          {lawyer.about || 'View this lawyer’s profile to learn more about their legal background and services.'}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Scale className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              Experience
            </dt>
            <dd className="mt-1 text-sm font-bold text-slate-900">{lawyer.experience || 'Not listed'}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              Cases handled
            </dt>
            <dd className="mt-1 text-sm font-bold text-slate-900">{Number(lawyer.casesHandled) || 0}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => onClick(lawyer)}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          View lawyer profile
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
