import React from 'react';
import LawyerVerificationTable from './LawyerVerificationTable';
import LawyerVerificationStats from './LawyerVerificationStats';
import { BadgeCheck } from 'lucide-react';

const LawyerVerification = () => {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <BadgeCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Lawyer Verifications</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review credentials and manage lawyer applications in one place.
          </p>
        </div>
      </div>
      
      <LawyerVerificationStats />
      
      <LawyerVerificationTable />
    </div>
  );
};

export default LawyerVerification;
