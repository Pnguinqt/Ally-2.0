import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Scale,
  UsersRound,
} from "lucide-react";
import { SearchPanel } from "../components/SearchPanel";
import { LawyerProfile } from "../components/LawyerProfile";
import { adminService } from "../services/adminService";

const lawyerIsVerified = (lawyer) =>
  Boolean(
    lawyer?.raw?.credentialsVerified ||
    ["approved", "verified"].includes(
      String(
        lawyer?.raw?.status || lawyer?.raw?.verificationStatus || "",
      ).toLowerCase(),
    ),
  );

const numericExperience = (value) =>
  Number(typeof value === "string" ? value.replace(/\D/g, "") : value) || 0;

export const LawyerDirectoryPage = () => {
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    specialty: "All Specialties",
    location: "All Locations",
    experience: "All Years",
    availability: "Any Day",
    casesHandled: "All Cases",
    rating: "Any Rating",
  });
  const [fetchedLawyers, setFetchedLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const lawyersPerPage = 8;

  useEffect(() => {
    let active = true;

    const fetchLawyers = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminService.getAllLawyers();
        if (!active) return;

        setFetchedLawyers(
          data.map((lawyer) => {
            const firstName =
              lawyer.Fname || lawyer.firstName || lawyer.fname || "";
            const lastName =
              lawyer.Lname || lawyer.lastName || lawyer.lname || "";
            const specialization =
              lawyer.specialization || lawyer.practiceAreas || [];

            return {
              id: lawyer.userId || lawyer.id,
              name: `${firstName} ${lastName}`.trim(),
              specialty: Array.isArray(specialization)
                ? specialization.filter(Boolean).join(", ") || "Not specified"
                : specialization || "Not specified",
              location: [lawyer.city, lawyer.province]
                .filter(Boolean)
                .join(", "),
              rating: lawyer.rating || 0,
              experience: lawyer.experience
                ? typeof lawyer.experience === "string" &&
                  lawyer.experience.includes("year")
                  ? lawyer.experience
                  : `${lawyer.experience} years`
                : "Not listed",
              fee: lawyer.consultationFee
                ? `₱${lawyer.consultationFee}/hour`
                : lawyer.fee || "Not listed",
              image:
                `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
                "L",
              profilePhotoUrl:
                lawyer.profilePhotoUrl || lawyer.profilePhoto || null,
              about:
                lawyer.bio ||
                lawyer.about ||
                "Legal professional available to discuss your case and explain possible next steps.",
              education:
                lawyer.educationInstitution ||
                lawyer.education ||
                "Not specified",
              areas: Array.isArray(specialization)
                ? specialization
                : String(specialization)
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
              casesHandled: lawyer.casesHandled || 0,
              raw: lawyer,
            };
          }),
        );
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError.message || "Failed to fetch lawyers");
        setFetchedLawyers([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchLawyers();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const verifiedLawyers = useMemo(
    () => fetchedLawyers.filter(lawyerIsVerified),
    [fetchedLawyers],
  );

  const filteredLawyers = useMemo(
    () =>
      verifiedLawyers
        .filter((lawyer) => {
          const query = searchQuery.trim().toLowerCase();
          if (
            query &&
            ![lawyer.name, lawyer.specialty, lawyer.location, lawyer.experience]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(query))
          )
            return false;

          if (
            filters.specialty !== "All Specialties" &&
            !lawyer.specialty
              .toLowerCase()
              .includes(filters.specialty.toLowerCase())
          )
            return false;

          if (
            filters.location &&
            filters.location !== "All Locations" &&
            !lawyer.location
              .toLowerCase()
              .includes(filters.location.toLowerCase())
          )
            return false;

          const years = numericExperience(lawyer.experience);
          if (filters.experience === "1-3" && !(years >= 1 && years <= 3))
            return false;
          if (filters.experience === "4-7" && !(years >= 4 && years <= 7))
            return false;
          if (filters.experience === "8+" && years < 8) return false;

          const cases = Number(lawyer.casesHandled) || 0;
          if (filters.casesHandled === "1-10" && !(cases >= 1 && cases <= 10))
            return false;
          if (filters.casesHandled === "11-50" && !(cases >= 11 && cases <= 50))
            return false;
          if (filters.casesHandled === "51+" && cases < 51) return false;

          return true;
        })
        .sort(
          (first, second) =>
            (Number(second.casesHandled) || 0) -
              (Number(first.casesHandled) || 0) ||
            numericExperience(second.experience) -
              numericExperience(first.experience),
        ),
    [filters, searchQuery, verifiedLawyers],
  );

  const totalPages = Math.ceil(filteredLawyers.length / lawyersPerPage);
  const paginatedLawyers = filteredLawyers.slice(
    (currentPage - 1) * lawyersPerPage,
    currentPage * lawyersPerPage,
  );

  const specialtyCount = useMemo(
    () =>
      new Set(verifiedLawyers.flatMap((lawyer) => lawyer.areas).filter(Boolean))
        .size,
    [verifiedLawyers],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, verifiedLawyers.length]);

  return (
    <div className="min-h-full bg-slate-50/70 pb-12">
      {selectedLawyer && (
        <LawyerProfile
          lawyer={selectedLawyer}
          onClose={() => setSelectedLawyer(null)}
        />
      )}

      <section className="border-b border-blue-100 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center black gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ring-white/20">
              <Scale className="h-4 w-4" aria-hidden="true" />
              Verified legal professionals
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Find the right lawyer for your case
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base sm:leading-7">
              Compare verified lawyers by practice area, location, and
              experience, then review a profile before making contact.
            </p>

            {!loading && !error && (
              <div className="mt-7 flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-white/20">
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  {verifiedLawyers.length} verified lawyer
                  {verifiedLawyers.length === 1 ? "" : "s"}
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-white/20">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {specialtyCount} practice area
                  {specialtyCount === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {loading && (
          <div aria-label="Loading lawyers" className="space-y-6">
            <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <section className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertCircle
                className="h-6 w-6 text-red-600"
                aria-hidden="true"
              />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              We couldn’t load the lawyer directory
            </h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </section>
        )}

        {!loading && !error && (
          <>
            <SearchPanel
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filters={filters}
              setFilters={setFilters}
              lawyers={paginatedLawyers}
              filterOptions={verifiedLawyers}
              onLawyerSelect={setSelectedLawyer}
              totalLawyers={filteredLawyers.length}
            />

            {totalPages > 1 && (
              <nav
                className="mt-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                aria-label="Lawyer directory pages"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <p className="text-sm font-medium text-slate-600">
                  Page{" "}
                  <span className="font-bold text-slate-950">
                    {currentPage}
                  </span>{" "}
                  of {totalPages}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
};
