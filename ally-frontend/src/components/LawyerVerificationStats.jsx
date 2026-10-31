import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { adminService } from '../services/adminService';
import { toast } from 'react-toastify';

const LawyerVerificationStats = () => {
  const [stats, setStats] = useState({
    pendingVerifications: 0,
    totalVerified: 0,
    totalRejected: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getVerificationStats();
      setStats({
        pendingVerifications: data.pending || 0,
        totalVerified: data.verified || 0,
        totalRejected: data.rejected || 0
      });
    } catch (error) {
      console.error('Failed to fetch verification stats:', error);
      setError('Failed to load statistics');
      toast.error('Failed to load verification statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3" aria-label="Loading verification statistics">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-28 rounded bg-gray-200" />
            <div className="mt-4 h-8 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        <div className="flex items-center justify-between">
          <p>{error}</p>
          <button
            onClick={fetchStats}
            className="flex items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
        <div className="flex items-start justify-between">
          <div className="pl-1">
            <p className="text-sm font-medium text-gray-600">Pending review</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{stats.pendingVerifications}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
        <div className="flex items-start justify-between">
          <div className="pl-1">
            <p className="text-sm font-medium text-gray-600">Approved</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{stats.totalVerified}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-rose-500" />
        <div className="flex items-start justify-between">
          <div className="pl-1">
            <p className="text-sm font-medium text-gray-600">Rejected</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{stats.totalRejected}</p>
          </div>
          <div className="rounded-lg bg-rose-50 p-2.5 text-rose-600">
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LawyerVerificationStats;
