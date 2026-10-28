import React, { useState } from 'react';
import { Calendar, User, Clock, CheckCircle, XCircle, AlertCircle, Check, X, Trash2, MapPin, Pencil } from 'lucide-react';

const CaseCard = ({ case_, userRole, onStatusChange, onDeleteCase, onEditCase, onCardClick, onTrackCase }) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'ACCEPTED':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'DECLINED':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'DECLINED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleStatusChange = async (newStatus, e) => {
    e.stopPropagation(); // Prevent card click when button is clicked
    if (!onStatusChange) return;
    
    if (newStatus === 'ACCEPTED') {
      setIsAccepting(true);
    } else if (newStatus === 'DECLINED') {
      setIsDeclining(true);
    }
    
    try {
      await onStatusChange(case_.caseId, newStatus);
    } catch (error) {
      console.error('Error changing case status:', error);
    } finally {
      setIsAccepting(false);
      setIsDeclining(false);
    }
  };

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(case_);
    }
  };

  const canClientDelete = userRole === 'CLIENT' && ['PENDING', 'DECLINED'].includes(case_.status);
  const canClientEdit = userRole === 'CLIENT' && !['COMPLETED', 'CANCELLED'].includes(case_.status);

  const handleEditCase = (e) => {
    e.stopPropagation();
    if (canClientEdit) {
      onEditCase?.(case_);
    }
  };

  const handleTrackCase = (e) => {
    e.stopPropagation();
    onTrackCase?.(case_.caseId);
    const tracker = document.getElementById('case-tracker-panel');
    tracker?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteCase = async (e) => {
    e.stopPropagation();
    if (!onDeleteCase || !canClientDelete) return;

    setIsDeleting(true);
    try {
      await onDeleteCase(case_.caseId);
    } catch (error) {
      console.error('Error deleting case:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Get participant name based on user role
  const getParticipantName = () => {
    if (userRole === 'LAWYER' && case_.client) {
      return `${case_.client.Fname} ${case_.client.Lname}`;
    } else if (userRole === 'CLIENT' && case_.lawyer) {
      return `${case_.lawyer.Fname} ${case_.lawyer.Lname}`;
    } else if (userRole === 'CLIENT' && !case_.lawyer && case_.status === 'PENDING') {
      return 'Awaiting assignment';
    }
    return 'N/A';
  };

  const getParticipantLabel = () => {
    if (userRole === 'LAWYER') {
      return 'Client';
    } else if (userRole === 'CLIENT' && case_.lawyer) {
      return 'Lawyer';
    } else if (userRole === 'CLIENT' && !case_.lawyer) {
      return 'Status';
    }
    return 'Participant';
  };

  return (
    <div
      className="p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between">
        {/* Main Information */}
        <div className="flex-1 min-w-0">
          {/* Case Title and ID */}
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-blue-600">
              #{case_.caseId}
            </span>
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm font-medium text-gray-900 truncate">
              {case_.title}
            </span>
          </div>
          
          {/* Participant and Date Information */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-blue-400" />
                <span>
                  {getParticipantLabel()}: {getParticipantName()}
                </span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <span>{formatDate(case_.dateSubmitted)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center space-x-3 ml-4">
          <button
            onClick={handleTrackCase}
            className="flex items-center px-3 py-1.5 text-xs text-blue-700 transition-colors bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
          >
            <MapPin className="w-3 h-3 mr-1" />
            Track
          </button>

          {canClientEdit && (
            <button
              onClick={handleEditCase}
              className="flex items-center px-3 py-1.5 text-xs text-slate-700 transition-colors bg-white border border-slate-300 rounded hover:bg-slate-50"
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </button>
          )}

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(case_.status)}`}>
            {getStatusIcon(case_.status)}
            <span className="capitalize">
              {case_.status?.toLowerCase()}
            </span>
          </div>

          {/* Action Buttons - Only show for pending cases and lawyers */}
          {case_.status === 'PENDING' && userRole === 'LAWYER' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => handleStatusChange('ACCEPTED', e)}
                disabled={isAccepting}
                className="flex items-center px-3 py-1.5 text-xs text-white transition-colors bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-3 h-3 mr-1" />
                {isAccepting ? 'Accepting...' : 'Accept'}
              </button>
              <button
                onClick={(e) => handleStatusChange('DECLINED', e)}
                disabled={isDeclining}
                className="flex items-center px-3 py-1.5 text-xs text-white transition-colors bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-3 h-3 mr-1" />
                {isDeclining ? 'Declining...' : 'Decline'}
              </button>
            </div>
          )}

          {canClientDelete && (
            <button
              onClick={handleDeleteCase}
              disabled={isDeleting}
              className="flex items-center px-3 py-1.5 text-xs text-red-700 transition-colors bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseCard;
