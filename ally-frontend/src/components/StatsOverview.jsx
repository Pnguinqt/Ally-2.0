import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { userService } from '../services/userService';
import { toast } from 'react-toastify';

const StatsOverview = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getUserStats();
      setStats({
        totalUsers: data.totalUsers || 0,
        activeUsers: data.activeUsers || 0,
        inactiveUsers: data.inactiveUsers || 0
      });
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      setError('Failed to load statistics');
      toast.error('Failed to load user statistics');
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
      <div className="grid gap-4 sm:grid-cols-3" aria-label="Loading user statistics">
        {[1, 2, 3].map((item) => (
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
      <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-blue-500" />
        <div className="flex items-start justify-between">
          <div className="pl-1">
            <p className="text-sm font-medium text-gray-600">Total users</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{stats.totalUsers}</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
        <div className="flex items-start justify-between">
          <div className="pl-1">
            <p className="text-sm font-medium text-gray-600">Active users</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{stats.activeUsers}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
            <UserCheck className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-rose-500" />
        <div className="flex items-start justify-between">
          <div className="pl-1">
            <p className="text-sm font-medium text-gray-600">Inactive users</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{stats.inactiveUsers}</p>
          </div>
          <div className="rounded-lg bg-rose-50 p-2.5 text-rose-600">
            <UserX className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsOverview;
