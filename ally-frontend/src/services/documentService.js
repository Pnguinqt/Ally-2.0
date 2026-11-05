// Document service for handling document management API calls
import { getAuthData } from '../utils/auth.jsx';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/documents`;

export const documentService = {
  previewDocument: async (documentId, pin, signal) => {
    const auth = getAuthData();
    if (!auth) throw new Error('Please log in again.');
    const response = await fetch(`${API_BASE_URL}/${documentId}/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }), signal, cache: 'no-store',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Unable to preview document. Check the case PIN.');
    }
    return response.blob();
  },
  verifyPreviewPin: async (caseId, pin, signal) => {
    const auth = getAuthData();
    if (!auth) throw new Error('Please log in again.');
    const response = await fetch(`${API_BASE_URL}/case/${caseId}/pin/verify`, {
      method: 'POST', headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }), signal, cache: 'no-store',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Unable to preview file. Check the case PIN.');
    }
  },
  setupPin: async (caseId) => {
    const auth = getAuthData();
    const response = await fetch(`${API_BASE_URL}/case/${caseId}/pin/setup`, {
      method: 'POST', headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!response.ok) throw new Error('Only the assigned lawyer can set up a PIN for an accepted case that has no PIN.');
    return response.json();
  },
  pinAccess: async (caseId, pin) => {
    const auth = getAuthData();
    const response = await fetch(`${API_BASE_URL}/case/${caseId}/pin`, {
      method: pin === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      ...(pin === undefined ? {} : { body: JSON.stringify({ pin }) }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || (response.status === 429 ? 'Too many attempts. Try again in 15 minutes.' : 'Unable to unlock documents. Check the four-digit PIN.'));
    }
    return response.json();
  },
  // Get documents for a specific case
  getCaseDocuments: async (caseId) => {
    try {
      const authData = getAuthData();
      if (!authData) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/case/${caseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view documents for this case');
        }
        if (response.status === 404) {
          throw new Error('Case not found');
        }
        throw new Error('Failed to fetch case documents');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching case documents:', error);
      throw error;
    }
  },

  // Get document count for a specific case
  getDocumentCount: async (caseId) => {
    try {
      const authData = getAuthData();
      if (!authData) {
        console.error('Not authenticated when trying to get document count');
        return 0;
      }

      const response = await fetch(`${API_BASE_URL}/case/${caseId}/count`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies if any
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.error('Permission denied when getting document count');
          return 0;
        }
        if (response.status === 401) {
          console.error('Authentication failed when getting document count');
          return 0;
        }
        throw new Error('Failed to fetch document count');
      }

      const count = await response.json();
      return typeof count === 'number' ? count : 0;
    } catch (error) {
      console.error('Error fetching document count:', error);
      return 0;
    }
  },

  // Upload document to a specific case
  uploadDocument: async (userId, caseId, file, documentMetadata = {}) => {
    try {
      const authData = getAuthData();
      if (!authData) {
        throw new Error('Not authenticated');
      }

      // Validate file size (20MB limit)
      const maxSize = 20 * 1024 * 1024; // 20MB in bytes
      if (file.size > maxSize) {
        throw new Error('File size exceeds 20MB limit');
      }

      // Validate file type
      const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        throw new Error('File type not allowed. Supported formats: PDF, DOC, DOCX, TXT, JPG, JPEG, PNG');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('caseId', caseId);
      formData.append('documentName', documentMetadata.documentName || file.name);
      formData.append('documentType', documentMetadata.documentType || fileExtension);
      formData.append('status', documentMetadata.status || 'uploaded');

      const response = await fetch(`${API_BASE_URL}/upload/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to upload documents to this case');
        }
        if (response.status === 400) {
          const errorText = await response.text();
          throw new Error(errorText || 'Invalid request - please check your file and try again');
        }
        throw new Error('Failed to upload document');
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  // Delete a document
  deleteDocument: async (documentId) => {
    try {
      const authData = getAuthData();
      if (!authData) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this document');
        }
        if (response.status === 404) {
          throw new Error('Document not found');
        }
        throw new Error('Failed to delete document');
      }

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Download a document
  downloadDocument: async (documentId, documentName, pin, signal) => {
    try {
      const authData = getAuthData();
      if (!authData) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/${documentId}/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }), signal, cache: 'no-store',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Unable to download file. Check the case PIN.');
      }

      const blob = await response.blob();
      if (signal?.aborted) return false;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  },

  // Generate an on-demand AI summary for a document the user can access
  summarizeDocument: async (documentId) => {
    const authData = getAuthData();
    if (!authData) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/${documentId}/summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let message = 'Could not summarize this document';
      try {
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch {
        // Keep the user-friendly fallback when the server returns plain text.
      }
      throw new Error(message);
    }

    return await response.json();
  },

  // Get document details
  getDocumentDetails: async (documentId) => {
    try {
      const authData = getAuthData();
      if (!authData) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/${documentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view this document');
        }
        if (response.status === 404) {
          throw new Error('Document not found');
        }
        throw new Error('Failed to fetch document details');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching document details:', error);
      throw error;
    }
  },

  // Utility functions
  formatFileSize: (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    if (typeof bytes !== 'number' || isNaN(bytes)) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  getFileType: (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
      return 'unknown';
    }
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'unknown';
  },

  formatDate: (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  validateFileType: (fileName) => {
    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
    const fileExtension = fileName.split('.').pop().toLowerCase();
    return allowedTypes.includes(fileExtension);
  },

  validateFileSize: (fileSize, maxSizeMB = 20) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSize <= maxSizeBytes;
  }
};
