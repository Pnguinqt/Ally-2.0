import React, { useState, useEffect } from 'react';
import {
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { adminService } from '../services/adminService';

// Utility function for proper text capitalization
const capitalizeText = (text) => {
  if (!text) return '';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const normalizeStatus = (status) => {
  const value = String(status || 'pending').toLowerCase();
  return value === 'verified' ? 'approved' : value;
};

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const getInitials = (firstName, lastName) =>
  `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'L';

const LawyerVerificationTable = () => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const fetchLawyers = async () => {
  try {
    setIsLoading(true);
    setError(null);
    const data = await adminService.getAllLawyers();
    const mapped = data.map(lawyer => {
      const hasCredentials = lawyer.credentials && lawyer.credentials.trim() !== '';
      return {
        id: lawyer.userId,
        firstName: capitalizeText(lawyer.firstName || lawyer.Fname),
        lastName: capitalizeText(lawyer.lastName || lawyer.Lname),
        name: `${capitalizeText(lawyer.firstName || lawyer.Fname)} ${capitalizeText(lawyer.lastName || lawyer.Lname)}`,
        email: lawyer.email,
        barNumber: lawyer.barNumber,
        practiceAreas: (lawyer.specialization || []).map(area => capitalizeText(area)),
        submittedDate: lawyer.createdAt || '',
        status: !hasCredentials ? 'rejected' : normalizeStatus(lawyer.status),
        phoneNumber: lawyer.phoneNumber,
        address: capitalizeText(lawyer.address),
        city: capitalizeText(lawyer.city),
        province: capitalizeText(lawyer.province),
        zipCode: lawyer.zipCode,
        experience: lawyer.experience,
        credentials: lawyer.credentials,
        profilePhoto: lawyer.profilePhoto,
        // Additional fields for profile
        successRate: lawyer.successRate || 95,
        casesHandled: lawyer.casesHandled || 0,
        // Additional fields for credentials
        degree: lawyer.degree || 'Bachelor of Laws',
        graduationYear: lawyer.graduationYear,
        academicHonors: lawyer.academicHonors,
        yearAdmitted: lawyer.yearAdmitted,
        jurisdiction: lawyer.jurisdiction || 'Philippines'
      };
    });
    setVerificationRequests(mapped);
    } catch (error) {
      console.error('Failed to fetch lawyers:', error);
      setError('Failed to load lawyer verification requests. Please try again later.');
      toast.error('Failed to load lawyer verification requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLawyers();
  }, []);

  const handleViewLawyer = (lawyer) => {
    setSelectedLawyer(lawyer);
    setIsModalOpen(true);
  };

  const handleApprove = async (id) => {
    try {
      setProcessingIds(prev => new Set([...prev, id]));
      await adminService.verifyLawyer(id);
      
      // Update local state
      setVerificationRequests(requests =>
        requests.map(request =>
          request.id === id ? { ...request, status: 'approved' } : request
        )
      );
      
      toast.success('Lawyer Verification Approved Successfully');
      
      // Refresh the list after a short delay
      setTimeout(() => {
        fetchLawyers();
      }, 1000);
    } catch (error) {
      console.error('Error approving lawyer:', error);
      toast.error('Failed to Approve Lawyer Verification');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleReject = async (id) => {
    try {
      setProcessingIds(prev => new Set([...prev, id]));
      await adminService.rejectLawyer(id);
      
      // Update local state
      setVerificationRequests(requests =>
        requests.map(request =>
          request.id === id ? { ...request, status: 'rejected' } : request
        )
      );
      
      toast.success('Lawyer Verification Rejected');
      
      // Refresh the list after a short delay
      setTimeout(() => {
        fetchLawyers();
      }, 1000);
    } catch (error) {
      console.error('Error rejecting lawyer:', error);
      toast.error('Failed to Reject Lawyer Verification');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const filteredRequests = verificationRequests.filter(request => {
    const matchesStatus = filter === 'all' || request.status === filter;
    const searchTerm = searchQuery.trim().toLowerCase();
    const matchesSearch = !searchTerm || [
      request.name,
      request.email,
      request.barNumber,
      ...request.practiceAreas,
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(searchTerm));

    return matchesStatus && matchesSearch;
  });

  const filterCounts = {
    all: verificationRequests.length,
    pending: verificationRequests.filter(request => request.status === 'pending').length,
    approved: verificationRequests.filter(request => request.status === 'approved').length,
    rejected: verificationRequests.filter(request => request.status === 'rejected').length,
  };

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-gray-600">Loading verification requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        <XCircle className="mx-auto h-8 w-8" aria-hidden="true" />
        <p className="mt-3 font-medium">{error}</p>
        <button
          onClick={fetchLawyers}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-gray-900">Application queue</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {filteredRequests.length} {filteredRequests.length === 1 ? 'application' : 'applications'} shown
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block sm:min-w-72">
                <span className="sr-only">Search applications</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, email, or bar number"
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <button
                type="button"
                onClick={fetchLawyers}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filter applications by status">
            {[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  filter === option.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                {option.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  filter === option.value ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
                }`}>
                  {filterCounts[option.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {currentItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Applicant
                  </th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">
                    Bar Number
                  </th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">
                    Practice Areas
                  </th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 xl:table-cell">
                    Submitted
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {currentItems.map((request) => (
                  <tr key={request.id} className="transition hover:bg-blue-50/40">
                    <td className="px-5 py-4">
                      <div className="flex min-w-52 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 ring-4 ring-white">
                          {getInitials(request.firstName, request.lastName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-gray-900">{request.name}</div>
                          <div className="mt-0.5 truncate text-xs text-gray-500">{request.email}</div>
                          <div className="mt-1 text-xs text-gray-500 sm:hidden">
                            Bar no. {request.barNumber || 'Not provided'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-4 font-medium text-gray-700 sm:table-cell">
                      {request.barNumber || 'Not provided'}
                    </td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {request.practiceAreas.slice(0, 2).map((area) => (
                          <span
                            key={area}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {area}
                          </span>
                        ))}
                        {request.practiceAreas.length > 2 && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            +{request.practiceAreas.length - 2}
                          </span>
                        )}
                        {request.practiceAreas.length === 0 && <span className="text-xs text-gray-400">Not specified</span>}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-4 text-gray-600 xl:table-cell">
                      {formatDate(request.submittedDate)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        request.status === 'approved' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' :
                        request.status === 'rejected' ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200' :
                        'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          request.status === 'approved' ? 'bg-emerald-500' :
                          request.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'
                        }`} />
                        {capitalizeText(request.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewLawyer(request)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Review
                        </button>
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={processingIds.has(request.id)}
                              aria-label={`Approve ${request.name}`}
                              title="Approve application"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {processingIds.has(request.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : <Check className="h-4 w-4" aria-hidden="true" />}
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              disabled={processingIds.has(request.id)}
                              aria-label={`Reject ${request.name}`}
                              title="Reject application"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {processingIds.has(request.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : <X className="h-4 w-4" aria-hidden="true" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">No applications found</h3>
            <p className="mt-1 text-sm text-gray-500">Try another search term or status filter.</p>
            {(searchQuery || filter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilter('all');
                }}
                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {filteredRequests.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium text-gray-900">{indexOfFirstItem + 1}</span>–
              <span className="font-medium text-gray-900">{Math.min(indexOfLastItem, filteredRequests.length)}</span> of{' '}
              <span className="font-medium text-gray-900">{filteredRequests.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="px-2 text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Combined Verification Modal */}
      {selectedLawyer && (
        <CombinedVerificationModal
          lawyer={selectedLawyer}
          isOpen={isModalOpen}
          isProcessing={processingIds.has(selectedLawyer.id)}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedLawyer(null);
          }}
          onApprove={async () => {
            await handleApprove(selectedLawyer.id);
            setIsModalOpen(false);
            setSelectedLawyer(null);
          }}
          onReject={async () => {
            await handleReject(selectedLawyer.id);
            setIsModalOpen(false);
            setSelectedLawyer(null);
          }}
        />
      )}
    </>
  );
};

// Combined Verification Modal Component
const CombinedVerificationModal = ({ lawyer, isOpen, isProcessing, onClose, onApprove, onReject }) => {
  const [activeTab, setActiveTab] = useState('details');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        className="relative my-6 flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
      >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                {getInitials(lawyer.firstName, lawyer.lastName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="verification-modal-title" className="truncate text-lg font-semibold text-gray-900">
                    {lawyer.name}
                  </h3>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    lawyer.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    lawyer.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {capitalizeText(lawyer.status)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-gray-500">{lawyer.email} · Bar no. {lawyer.barNumber || 'Not provided'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close review"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 bg-gray-50 px-5 pt-2 sm:px-6" role="tablist">
            <button
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                activeTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('details')}
              role="tab"
              aria-selected={activeTab === 'details'}
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Basic Information
            </button>
            <button
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                activeTab === 'credentials'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('credentials')}
              role="tab"
              aria-selected={activeTab === 'credentials'}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Credentials & Documents
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {activeTab === 'details' ? (
              <LawyerDetailsContent lawyer={lawyer} />
            ) : (
              <LawyerCredentialsContent lawyer={lawyer} />
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
            {lawyer.status === 'pending' && (
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  onClick={onReject}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Reject application
                </button>
                <button
                  onClick={onApprove}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve application
                </button>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

// Content Components
const LawyerDetailsContent = ({ lawyer }) => {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 p-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </div>
          <h4 className="font-semibold text-gray-900">Personal information</h4>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <DetailItem label="First name" value={capitalizeText(lawyer.firstName)} />
          <DetailItem label="Last name" value={capitalizeText(lawyer.lastName)} />
          <DetailItem label="Email address" value={lawyer.email} />
          <DetailItem label="Phone number" value={lawyer.phoneNumber} />
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 p-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </div>
          <h4 className="font-semibold text-gray-900">Location</h4>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <DetailItem label="Street address" value={capitalizeText(lawyer.address)} />
          </div>
          <DetailItem label="City" value={capitalizeText(lawyer.city)} />
          <DetailItem label="Province" value={capitalizeText(lawyer.province)} />
          <DetailItem label="ZIP code" value={lawyer.zipCode} />
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 p-5 lg:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
          </div>
          <h4 className="font-semibold text-gray-900">Professional overview</h4>
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <DetailItem label="Years of experience" value={lawyer.experience} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Areas of practice</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
            {lawyer.practiceAreas?.length > 0 ? (
              lawyer.practiceAreas.map((area, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100"
                >
                  {capitalizeText(area)}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No areas specified</span>
            )}
            </dd>
          </div>
        </div>
      </section>
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div>
    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="mt-1.5 break-words text-sm font-medium text-gray-900">{value || 'Not provided'}</dd>
  </div>
);

const LawyerCredentialsContent = ({ lawyer }) => {
  const handleViewDocument = (file) => {
    if (typeof file === 'string' && /^https?:\/\//i.test(file)) {
      window.open(file, '_blank');
    } else if (file && file.url) {
      window.open(file.url, '_blank');
    } else {
      window.open(`${import.meta.env.VITE_API_BASE_URL}/users/lawyerCredentials/${lawyer.id}`, '_blank');
    }
  };

  const credentialFileName = getCredentialFileName(lawyer.credentials);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 p-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
          </div>
          <h4 className="font-semibold text-gray-900">Educational background</h4>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <DetailItem label="Institution" value={lawyer.educationInstitution} />
          </div>
          <DetailItem label="Degree" value={lawyer.degree || 'Bachelor of Laws'} />
          <DetailItem label="Graduation year" value={lawyer.graduationYear} />
          <div className="sm:col-span-2">
            <DetailItem label="Academic honors" value={lawyer.academicHonors || 'None specified'} />
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 p-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <h4 className="font-semibold text-gray-900">Bar license information</h4>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <DetailItem label="Bar license number" value={lawyer.barNumber} />
          <DetailItem label="Year admitted" value={lawyer.yearAdmitted} />
          <DetailItem label="Jurisdiction" value={lawyer.jurisdiction || 'Philippines'} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">License status</dt>
            <dd className="mt-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 p-5 lg:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <h4 className="font-semibold text-gray-900">Supporting documents</h4>
        </div>
          {lawyer.credentials ? (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-gray-200">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="text-sm font-semibold text-gray-900">Bar license certificate</h5>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {credentialFileName}
                  </p>
                </div>
                <button 
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                  onClick={() => handleViewDocument(lawyer.credentials)}
                >
                  View document
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-gray-600">No documents uploaded</p>
            </div>
          )}
      </section>
    </div>
  );
};

const getCredentialFileName = (credentials) => {
  if (!credentials) return 'No file selected';
  if (typeof credentials !== 'string') return credentials.name || 'Uploaded credential file';

  const normalized = credentials.replace(/\\/g, '/');
  return normalized.split('/').pop() || 'Uploaded credential file';
};

export default LawyerVerificationTable;
