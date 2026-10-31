import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Edit,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  UserX,
  X,
} from 'lucide-react';
import { userService } from '../services/userService';
import { adminService } from '../services/adminService';
import useDebounce from '../hooks/useDebounce';
import UserProfileModal from './UserProfileModal';
import { toast } from 'react-toastify';

// Text formatting helpers
const capitalizeFirstLetter = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const formatName = (name) => {
  if (!name) return 'No Name Provided';
  return name.split(' ')
    .map(word => capitalizeFirstLetter(word))
    .join(' ');
};

const formatLocation = (city, province) => {
  const formattedCity = city?.split(' ')
    .map(word => capitalizeFirstLetter(word))
    .join(' ');
  const formattedProvince = province?.split(' ')
    .map(word => capitalizeFirstLetter(word))
    .join(' ');

  return [formattedCity, formattedProvince].filter(Boolean).join(', ');
};

const formatRole = (role) => {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

const formatStatus = (status) => {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const formatSpecialization = (spec) => {
  if (!spec) return '';
  return spec.split(/(?=[A-Z])/).map(word => capitalizeFirstLetter(word)).join(' ');
};

// Modal Components
const ViewUserModal = ({ user, onClose }) => {
  if (!user) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">User Details</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500">Name</label>
            <p className="font-medium">{user.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Email</label>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Role</label>
            <p className="font-medium capitalize">{user.role}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Join Date</label>
            <p className="font-medium">
              {new Date(user.joinDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Status</label>
            <p className="font-medium capitalize">{user.status}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditUserModal = ({ user, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'client',
    status: user?.status || 'active'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onUpdate(formData);
      onClose();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 id="edit-user-title" className="text-lg font-semibold text-gray-900">Edit user</h2>
            <p className="mt-1 text-sm text-gray-500">Update account details and access.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close edit user">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
          <div>
            <label htmlFor="edit-user-name" className="block text-sm font-medium text-gray-700">Full name</label>
            <input
              id="edit-user-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label htmlFor="edit-user-email" className="block text-sm font-medium text-gray-700">Email address</label>
            <input
              id="edit-user-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
            <label htmlFor="edit-user-role" className="block text-sm font-medium text-gray-700">Role</label>
            <select
              id="edit-user-role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="client">Client</option>
              <option value="lawyer">Lawyer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-user-status" className="block text-sm font-medium text-gray-700">Status</label>
            <select
              id="edit-user-status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ user, onClose, onConfirm }) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title">
        <div className="px-6 pb-5 pt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
        <h2 id="delete-user-title" className="mt-4 text-lg font-semibold text-gray-900">Delete user?</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          This will permanently delete <span className="font-semibold text-gray-700">{user.name}</span> and cannot be undone.
        </p>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            Delete user
          </button>
        </div>
      </div>
    </div>
  );
};

const UserManagementTable = ({ onAddUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    verificationStatus: 'all'
  });
  const [sort, setSort] = useState({ field: 'joinDate', direction: 'desc' });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);

  // Replace viewUser state with selectedUser for profile view
  const [selectedUser, setSelectedUser] = useState(null);

  // Debounced values
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedFilters = useDebounce(filters, 500);

  // Create a ref for the fetchUsers function
  const fetchUsersRef = useRef(null);

  // Fetch users data
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAllUsers();
      const formattedUsers = data.map(user => ({
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' '),
        email: user.email,
        role: user.accountType?.toLowerCase() || 'client',
        joinDate: user.createdAt || new Date().toISOString(),
        status: String(user.status || (user.isVerified ? 'active' : 'inactive')).toLowerCase(),
        verificationStatus: String(user.verificationStatus || (user.credentialsVerified ? 'verified' : 'pending')).toLowerCase(),
        // Additional fields
        phoneNumber: user.phoneNumber || user.phone,
        address: user.address,
        city: user.city,
        province: user.province,
        zipCode: user.zipCode,
        // Lawyer specific fields
        barNumber: user.barNumber,
        yearsOfExperience: user.yearsOfExperience || user.experience,
        specialization: user.specialization,
        practiceAreas: user.specialization || [],
        credentials: user.credentials,
        educationInstitution: user.educationInstitution,
        casesHandled: user.casesHandled,
        // Image
        image: user.profilePhoto || user.image,
        accountStatus: user.status,
        // Full details flag
        fullDetails: user.fullDetails
      }));
      setUsers(formattedUsers);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err.message || 'Failed to load users. Please try again later.');
      setUsers([]); // Set empty array on error
      // Show toast notification
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Store the fetchUsers function in the ref
  fetchUsersRef.current = fetchUsers;

  // Make the fetchUsers function available globally for the modal
  useEffect(() => {
    window.userTableRef = { current: { fetchUsers } };
    return () => {
      delete window.userTableRef;
    };
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSort = (field) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = (e) => {
    setSelectedUsers(e.target.checked ? filteredUsers.map(user => user.id) : []);
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleBulkAction = async (action) => {
    try {
      switch (action) {
        case 'activate':
          await userService.bulkUpdateStatus(selectedUsers, 'active');
          break;
        case 'deactivate':
          await userService.bulkUpdateStatus(selectedUsers, 'inactive');
          break;
        case 'delete':
          await Promise.all(selectedUsers.map(id => userService.deleteUser(id)));
          break;
        case 'export':
          await userService.exportUsers({ userIds: selectedUsers });
          break;
        default:
          break;
      }
      fetchUsers(); // Refresh the list
      setSelectedUsers([]); // Clear selection
    } catch (err) {
      console.error(`Failed to perform bulk action ${action}:`, err);
      setError(`Failed to perform bulk ${action}. Please try again later.`);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getRoleColor = (role) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'LAWYER':
        return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'CLIENT':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-200';
    }
  };

  const handleAction = async (action, userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    try {
      switch (action) {
        case 'view':
          setSelectedUser(user);
          break;
        case 'edit':
          setEditUser(user);
          break;
        case 'delete':
          setDeleteUser(user);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`Failed to perform action ${action}:`, err);
      setError(`Failed to perform ${action}. Please try again later.`);
    }
  };

  const handleUpdateUser = async (formData) => {
    try {
      // Split the name into first and last name
      const [fname, ...lastNames] = formData.name.split(' ');
      const lname = lastNames.join(' ');

      await userService.updateUser(editUser.id, {
        fname,
        lname,
        email: formData.email,
        accountType: formData.role.toUpperCase(),
        isVerified: formData.status === 'active'
      });

      await fetchUsers(); // Refresh the list
      setError(null);
    } catch (err) {
      console.error('Failed to update user:', err);
      setError('Failed to update user. Please try again later.');
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await userService.deleteUser(deleteUser.id);
      await fetchUsers(); // Refresh the list
      setDeleteUser(null);
      setError(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError('Failed to delete user. Please try again later.');
    }
  };

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filters.role === 'all' || user.role.toLowerCase() === filters.role.toLowerCase();
      const matchesStatus = filters.status === 'all' || user.status === filters.status;
      const matchesVerification = filters.verificationStatus === 'all' || 
                                 (user.role.toLowerCase() === 'lawyer' && user.verificationStatus === filters.verificationStatus);
      
      return matchesSearch && matchesRole && matchesStatus && matchesVerification;
    })
    .sort((a, b) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      if (sort.field === 'name') {
        return direction * a.name.localeCompare(b.name);
      }
      if (sort.field === 'joinDate') {
        return direction * (new Date(a.joinDate) - new Date(b.joinDate));
      }
      return 0;
    });

  const activeFilterCount = Object.values(filters).filter(value => value !== 'all').length;
  const hasActiveFilters = Boolean(searchTerm) || activeFilterCount > 0;

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ role: 'all', status: 'all', verificationStatus: 'all' });
  };

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-gray-600">Loading user directory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Unable to load users</h3>
          <p className="mt-1 max-w-lg text-sm text-gray-600">{error}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Reload page
            </button>
          </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Header Section */}
        <div className="border-b border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-gray-900">User directory</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {filteredUsers.length} of {users.length} users shown
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>
              <button
                onClick={onAddUser}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add user
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(150px,auto))]">
            <label className="block">
              <span className="sr-only">Search users</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search name or email"
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-20 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {searchTerm !== debouncedSearchTerm && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    Searching...
                  </span>
                )}
              </div>
            </label>
            <label className="block">
              <span className="sr-only">Filter by role</span>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All roles</option>
                <option value="client">Clients</option>
                <option value="lawyer">Lawyers</option>
                <option value="admin">Admins</option>
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Filter by account status</span>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Filter by verification status</span>
              <select
                value={filters.verificationStatus}
                onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All verification</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="unverified">Unverified</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex min-h-6 items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active` : 'Showing all accounts'}</span>
              {JSON.stringify(filters) !== JSON.stringify(debouncedFilters) && <span>· Updating...</span>}
            </div>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Clear filters
              </button>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-blue-800">
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBulkAction('activate')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50"
                >
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  Activate
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50"
                >
                  <UserX className="h-4 w-4" aria-hidden="true" />
                  Deactivate
                </button>
                <button
                  onClick={() => handleBulkAction('export')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="bg-gray-50">
                <th className="w-12 px-5 py-3.5 text-left">
                  <input
                    type="checkbox"
                    checked={filteredUsers.length > 0 && filteredUsers.every(user => selectedUsers.includes(user.id))}
                    onChange={handleSelectAll}
                    aria-label="Select all visible users"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th
                  className="cursor-pointer px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    User
                    {sort.field === 'name' && (
                      sort.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Bar Number</th>
                <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Location</th>
                <th
                  className="hidden cursor-pointer px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 xl:table-cell"
                  onClick={() => handleSort('joinDate')}
                >
                  <div className="flex items-center gap-1">
                    Joined
                    {sort.field === 'joinDate' && (
                      sort.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`transition hover:bg-gray-50 ${selectedUsers.includes(user.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      aria-label={`Select ${formatName(user.name)}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${getAvatarColor(user.name || 'User')} shadow-sm`}>
                        {user.image ? (
                          <img src={user.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-white">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </span>
                        )}
                      </div>
                      <div className="ml-3 min-w-0">
                        <div className="max-w-56 truncate font-semibold text-gray-900">
                          {formatName(user.name)}
                        </div>
                        <div className="max-w-56 truncate text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${getRoleColor(user.role)}`}>
                      {formatRole(user.role)}
                    </span>
                    {user.role === 'lawyer' && user.specialization && (
                      <div className="mt-1.5 max-w-40 truncate text-xs text-gray-500">
                        {formatSpecialization(user.specialization[0])}
                        {user.specialization.length > 1 ? ` +${user.specialization.length - 1}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-5 py-4 md:table-cell whitespace-nowrap">
                    <div className="font-medium text-gray-700">
                      {user.role === 'lawyer' ? (user.barNumber || 'Not provided') : '—'}
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 lg:table-cell whitespace-nowrap">
                    <div className="max-w-44 truncate text-gray-600">
                      {formatLocation(user.city, user.province) || 'Not provided'}
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 text-gray-500 xl:table-cell whitespace-nowrap">
                    {new Date(user.joinDate).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset
                      ${user.status === 'active' || user.status === 'approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                        user.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                        'bg-rose-50 text-rose-700 ring-rose-200'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        user.status === 'active' || user.status === 'approved' ? 'bg-emerald-500' :
                        user.status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                      {formatStatus(user.status)}
                    </span>
                    {user.role === 'lawyer' && (
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium
                          ${user.verificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' :
                            user.verificationStatus === 'pending' ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700'}`}>
                          {formatStatus(user.verificationStatus)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => handleAction('view', user.id)}
                        className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="View Details"
                        aria-label={`View ${formatName(user.name)}`}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button 
                        onClick={() => handleAction('edit', user.id)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="Edit User"
                        aria-label={`Edit ${formatName(user.name)}`}
                      >
                        <Edit className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button 
                        onClick={() => handleAction('delete', user.id)}
                        className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        title="Delete User"
                        aria-label={`Delete ${formatName(user.name)}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <div className="border-t border-gray-100 px-6 py-16 text-center">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <UserX className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">No users found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Replace ViewUserModal with UserProfileModal */}
      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          isAdminView={true}
          onEdit={(user) => handleAction('edit', user.id)}
          onDelete={(user) => handleAction('delete', user.id)}
          onStatusChange={(user, status) => handleAction(status === 'active' ? 'activate' : 'deactivate', user.id)}
          onResetPassword={(user) => handleAction('resetPassword', user.id)}
        />
      )}
      
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdate={handleUpdateUser}
        />
      )}
      
      {deleteUser && (
        <DeleteConfirmationModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
};

export default UserManagementTable;
