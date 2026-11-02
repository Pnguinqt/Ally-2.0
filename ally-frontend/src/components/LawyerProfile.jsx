// LawyerProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, MapPin, MessageCircle, X, FileText, CheckCircle2, Clock } from 'lucide-react';

import ChatModal from './ChatModal';
import CaseSubmissionForm from './CaseSubmissionForm';
import useCurrentUser from '../hooks/useCurrentUser';
import { lockBodyScroll, unlockBodyScroll } from '../utils/modalScrollLock';
import { fetchUserDetails } from '../utils/auth';
import { useDemoRuntime } from '../demo/DemoContext';

export const LawyerProfile = ({ lawyer, onClose }) => {
    const demo = useDemoRuntime();
    const navigate = useNavigate();
    const [isCaseSubmissionOpen, setIsCaseSubmissionOpen] = useState(false);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
    const { currentUser, loading } = useCurrentUser();

    // Debug log for currentUser
    useEffect(() => {
        console.log('LawyerProfile currentUser:', currentUser);
    }, [currentUser]);

    // Fetch profile photo URL if not already available
    useEffect(() => {
        const fetchProfilePhoto = async () => {
            if (!lawyer || demo) return;
            
            // Check if profile photo is already in lawyer data
            const existingPhoto = lawyer.profilePhotoUrl || lawyer.raw?.profilePhotoUrl || lawyer.raw?.profilePhoto;
            if (existingPhoto) {
                setProfilePhotoUrl(existingPhoto);
                return;
            }

            // Fetch from user API if we have a lawyer ID
            const lawyerId = lawyer.id || lawyer.userId || lawyer.raw?.userId || lawyer.raw?.id;
            if (lawyerId) {
                try {
                    const userDetails = await fetchUserDetails(lawyerId);
                    if (userDetails?.profilePhotoUrl) {
                        setProfilePhotoUrl(userDetails.profilePhotoUrl);
                    }
                } catch (error) {
                    console.error('Failed to fetch lawyer profile photo:', error);
                }
            }
        };

        fetchProfilePhoto();
    }, [lawyer]);

    const handleMessage = () => {
        if (loading) {
            console.log('Still loading user data...');
            return;
        }

        if (currentUser && currentUser.id) {
            console.log('User data available, opening chat modal:', currentUser);
            setIsChatModalOpen(true);
        } else {
            console.error('User data not available, redirecting to login. Current user:', currentUser);
            navigate('/login');
        }
    };

    // Helper to robustly get education institution (camelCase or snake_case)
    const getEducationInstitution = (lawyerObj) => {
        return (
            lawyerObj?.educationInstitution ||
            lawyerObj?.education_institution ||
            lawyerObj?.EducationInstitution ||
            lawyerObj?.education ||
            ''
        );
    };

    

    // Helper to robustly get cases handled (camelCase and snake_case)
    const getCasesHandled = (lawyerObj) => {
        return lawyerObj?.casesHandled ?? lawyerObj?.casesHandled;
    };

    // Disable body scroll when modal is open (using counter for nested modals)
    useEffect(() => {
        if (lawyer) {
            lockBodyScroll();
        }
        return () => {
            unlockBodyScroll();
        };
    }, [lawyer]);

    if (!lawyer) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Loading lawyer profile...</p>
            </div>
        );
    }

    return (
        <>
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center sm:p-0">
                    <div className="fixed inset-0 transition-opacity bg-black bg-opacity-60 backdrop-blur-sm" onClick={onClose}></div>

                    <div className="relative inline-block overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-xl sm:max-w-4xl sm:w-full max-h-[90vh] flex flex-col">
                        <div className="absolute right-4 top-4 z-10">
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 bg-white rounded-full p-1">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                    <div className="p-8 overflow-y-auto flex-1">
                        <div className="flex items-start mb-6 space-x-4">
                            <div className="flex items-center justify-center w-20 h-20 text-2xl font-semibold text-white bg-blue-500 rounded-full overflow-hidden">
                                {profilePhotoUrl || lawyer?.profilePhotoUrl || lawyer?.raw?.profilePhotoUrl || lawyer?.raw?.profilePhoto ? (
                                    <img 
                                        src={profilePhotoUrl || lawyer.profilePhotoUrl || lawyer.raw?.profilePhotoUrl || lawyer.raw?.profilePhoto} 
                                        alt="Profile" 
                                        className="object-cover w-full h-full"
                                        onError={(e) => {
                                            // Fallback to initials if image fails to load
                                            e.target.style.display = 'none';
                                            const parent = e.target.parentElement;
                                            const firstName = lawyer?.firstName || lawyer?.name?.split(' ')[0] || '';
                                            const lastName = lawyer?.lastName || lawyer?.name?.split(' ')[1] || '';
                                            parent.innerHTML = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'L';
                                        }}
                                    />
                                ) : (
                                    ((lawyer?.firstName || lawyer?.name?.split(' ')[0] || '').charAt(0) + (lawyer?.lastName || lawyer?.name?.split(' ')[1] || '').charAt(0)).toUpperCase() || 'L'
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-bold">{lawyer?.name || `${lawyer?.firstName || ''} ${lawyer?.lastName || ''}`}</h2>
                                    {(lawyer?.raw?.credentialsVerified || lawyer?.raw?.status === 'approved' || lawyer?.raw?.verificationStatus === 'verified') ? (
                                        <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Verified</span>
                                        </div>
                                    ) : (lawyer?.raw?.status === 'pending' || lawyer?.raw?.verificationStatus === 'pending' || (!lawyer?.raw?.credentialsVerified && lawyer?.raw?.credentials)) ? (
                                        <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                                            <Clock className="w-4 h-4" />
                                            <span>Pending</span>
                                        </div>
                                    ) : null}
                                </div>
                                <span className="inline-block px-3 py-1 mt-1 text-sm font-medium text-blue-800 bg-blue-100 rounded-full">
                                    {lawyer?.specialty || 'Legal Advisor'}
                                </span>
                                <p className="flex items-center mt-2 text-gray-600">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    {lawyer?.location || lawyer?.city || ''}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-6 mb-6 md:grid-cols-2">
                            <div>
                                <h3 className="mb-2 font-semibold">Cases Handled</h3>
                                <p className="font-semibold text-blue-600">{getCasesHandled(lawyer) !== undefined ? getCasesHandled(lawyer) : 'N/A'}</p>
                            </div>
                            <div>
                                <h3 className="mb-2 font-semibold">Experience</h3>
                                <p>{lawyer?.experience || 'No experience listed.'}</p>
                            </div>
                            <div>
                                <h3 className="mb-2 font-semibold">Availability</h3>
                                <p>Available</p>
                            </div>
                            <div>
                                <h3 className="mb-2 font-semibold">Education</h3>
                                <p>{getEducationInstitution(lawyer) || 'Not specified'}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="mb-3 font-semibold">Areas of Practice</h3>
                            <div className="flex flex-wrap gap-2">
                                {Array.isArray(lawyer?.areas) && lawyer.areas.length > 0 ? (
                                    lawyer.areas.map((area, index) => (
                                        <span key={index} className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded-full">
                                            {area}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-gray-400">No areas listed</span>
                                )}
                            </div>
                        </div>

                        <div className="flex space-x-4">
                            <button
                                onClick={handleMessage}
                                className="flex items-center justify-center flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Message
                            </button>
                            <button
                                onClick={() => setIsCaseSubmissionOpen(true)}
                                className="flex items-center justify-center flex-1 px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Submit Case
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            {currentUser && currentUser.id && (
                <ChatModal
                    isOpen={isChatModalOpen}
                    onClose={() => setIsChatModalOpen(false)}
                    currentUserId={currentUser.id}
                    receiverId={String(lawyer?._id || lawyer?.id)}
                    currentUserRole={currentUser.role}
                    currentUserName={currentUser.name}
                    receiverName={lawyer ? `${lawyer?.firstName || ''} ${lawyer?.lastName || ''}`.trim() : 'Unknown Lawyer'}
                />
            )}

            {isCaseSubmissionOpen && (
                <CaseSubmissionForm
                    onClose={() => setIsCaseSubmissionOpen(false)}
                    onSuccess={() => {
                        setIsCaseSubmissionOpen(false);
                        // Optionally close the lawyer profile modal as well
                        onClose();
                    }}
                    selectedLawyer={{
                        id: lawyer?.userId || lawyer?.id,
                        name: lawyer?.name || `${lawyer?.firstName || ''} ${lawyer?.lastName || ''}`.trim()
                    }}
                />
            )}
        </>
    );
};
