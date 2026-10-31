import React, { useState } from 'react';
import { UsersRound } from 'lucide-react';
import StatsOverview from '../components/StatsOverview';
import UserManagementTable from '../components/UserManagementTable';
import AddUserModal from '../components/AddUserModal';

const UserManagement = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleAddUserSuccess = () => {
    // Refresh the user table data
    if (window.userTableRef?.current?.fetchUsers) {
      window.userTableRef.current.fetchUsers();
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <UsersRound className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage accounts, roles, access, and user information.
          </p>
        </div>
      </div>
      
      <StatsOverview />
      
      <UserManagementTable onAddUser={() => setIsAddModalOpen(true)} />

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddUserSuccess}
      />
    </div>
  );
};

export default UserManagement;
