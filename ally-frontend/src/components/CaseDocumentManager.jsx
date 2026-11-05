import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, Trash2, Download, Search, Filter, AlertCircle, CheckCircle, Loader2, Eye, X, Plus, Minus, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { documentService as productionDocumentService } from '../services/documentService.js';
import { useDemoRuntime } from '../demo/DemoContext';
import { SAMPLE_PDF, SAMPLE_NAME } from '../demo/demoState';
import { validateFile, formatFileSize } from '../utils/filePreviewUtils.js';
import FilePreview from './FilePreview.jsx';
import MarkdownText from './shared/MarkdownText.jsx';
import SidePanel from './shared/SidePanel.jsx';

const CaseDocumentManager = ({ caseId, userRole, authData, onDocumentsChange }) => {
  const demo = useDemoRuntime();
  const documentService = demo?.documentService || productionDocumentService;
  const [pinAccess, setPinAccess] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [newPin, setNewPin] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [documentContent, setDocumentContent] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [photoPin, setPhotoPin] = useState('');
  const [photoPinError, setPhotoPinError] = useState('');
  const photoRequest = useRef(null);
  const photoUrl = useRef(null);

  const clearPhotoPreview = useCallback(() => {
    photoRequest.current?.abort();
    photoRequest.current = null;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
    setPhotoPin('');
    setPhotoPinError('');
  }, []);

  useEffect(() => () => clearPhotoPreview(), [caseId, clearPhotoPreview]);
  const [summaryDocument, setSummaryDocument] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [documentSummaries, setDocumentSummaries] = useState(() => demo?.getSummary() ? { [demo.getDocumentId()]: demo.getSummary() } : {});
  
  // Inline File List State
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewingFile, setPreviewingFile] = useState(null);
  const [showFilePreview, setShowFilePreview] = useState(false);

  const loadCaseDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await documentService.getCaseDocuments(parseInt(caseId));
      setDocuments(docs || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, documentService]);

  // Load case documents on mount and when caseId changes
  useEffect(() => {
    if (caseId && (demo || pinAccess?.caseId === caseId && pinAccess?.unlocked)) {
      loadCaseDocuments();
    }
  }, [caseId, loadCaseDocuments, demo, pinAccess]);

  useEffect(() => {
    let active = true;
    setPinAccess(null);
    setPin('');
    setNewPin(null);
    setPinError('');
    setDocuments([]);
    setSelectedFiles([]);
    setShowFilePreview(false);
    setPreviewingFile(null);
    setShowDocumentViewer(false);
    setDocumentSummaries({});
    if (!demo && caseId) documentService.pinAccess(caseId).then(access => {
      if (active) setPinAccess({ ...access, caseId });
    }).catch(error => { if (active) setPinError(error.message); });
    return () => { active = false; };
  }, [caseId, documentService, demo]);

  useEffect(() => {
    if (demo || !pinAccess?.unlocked) return;
    const timeout = setTimeout(() => {
      setPinAccess(current => ({ ...current, unlocked: false }));
      setDocuments([]);
      setDocumentSummaries({});
      setShowDocumentViewer(false);
      clearPhotoPreview();
      setDocumentContent(null);
      setSummaryDocument(null);
      setSelectedFiles([]);
      setShowFilePreview(false);
      setPreviewingFile(null);
    }, Math.max(0, pinAccess.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [pinAccess, demo, clearPhotoPreview]);

  const setupExistingPin = async () => {
    setUnlocking(true);
    setPinError('');
    try {
      const result = await documentService.setupPin(caseId);
      setNewPin(result.pin);
      setPinAccess({ caseId, configured: true, unlocked: false });
    } catch (error) { setPinError(error.message); }
    finally { setUnlocking(false); }
  };

  const unlockDocuments = async (event) => {
    event.preventDefault();
    setUnlocking(true);
    setPinError('');
    try {
      const access = await documentService.pinAccess(caseId, pin);
      setPinAccess({ ...access, caseId });
      setPin('');
    } catch (error) { setPinError(error.message); }
    finally { setUnlocking(false); }
  };

  // Clean up invalid files on component mount/case change
  useEffect(() => {
    setSelectedFiles(prev => {
      const validFiles = prev.filter(file => file && file.name && typeof file.size !== 'undefined');
      if (validFiles.length !== prev.length) {
        return validFiles;
      }
      return prev;
    });
  }, [caseId]);

  // Handle file selection
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    handleFiles(files);
  };

  // Handle drag and drop
  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  // Process files for inline list
  const handleFiles = async (files) => {
    if (userRole !== 'CLIENT' && userRole !== 'LAWYER') {
      toast.error('Only clients or lawyers can upload documents');
      return;
    }

    if (files.length === 0) return;

    // Validate files using the new validation utility
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      // Check if file is already in the list
      if (selectedFiles.some(existing => existing.name === file.name && existing.size === file.size)) {
        errors.push(`${file.name}: File already selected`);
        return;
      }

      const validation = validateFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.message}`);
        return;
      }
      
      // Additional legacy validation for compatibility
      if (!documentService.validateFileType(file.name)) {
        errors.push(`${file.name}: ${demo ? 'Use a PDF for this evaluation' : 'Unsupported file type'}`);
        return;
      }
      
      if (!documentService.validateFileSize(file.size)) {
        errors.push(`${file.name}: File size exceeds ${demo ? '10' : '20'}MB limit`);
        return;
      }
      
      // Add validation status and unique ID to file
      // Note: File object properties are getter-only, so we create a new object with copied properties
      const fileWithMeta = {
        // Copy File properties explicitly (since they're not enumerable)
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        // Keep reference to original File object for upload
        file: file,
        // Add metadata
        id: `${file.name}-${file.size}-${Date.now()}`,
        validationStatus: 'valid',
        uploadStatus: 'pending'
      };
      
      validFiles.push(fileWithMeta);
    });

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
    }

    if (validFiles.length === 0) return;

    // Clean up any invalid files from existing state before adding new ones
    setSelectedFiles(prev => {
      const cleanedPrev = prev.filter(file => file && file.name && typeof file.size !== 'undefined');
      return [...cleanedPrev, ...validFiles];
    });
    toast.success(`${validFiles.length} file${validFiles.length > 1 ? 's' : ''} added to upload queue`);
  };

  // Remove individual file from the list
  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
    toast.info('File removed from upload queue');
  };

  // Clear all files from the list
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setUploadProgress({});
    toast.info('All files cleared from upload queue');
  };

  // Upload a single file
  const uploadSingleFile = async (fileWithMeta) => {
    // Use the original File object for upload, or fallback to fileWithMeta if it's already a File
    const originalFile = fileWithMeta.file || fileWithMeta;
    
    const result = await documentService.uploadDocument(
      authData.userId,
      parseInt(caseId),
      originalFile,
      {
        documentName: fileWithMeta.name || originalFile.name || 'unknown',
        documentType: fileWithMeta.name ? documentService.getFileType(fileWithMeta.name) : 'unknown',
        status: 'uploaded'
      }
    );
    return result;
  };

  // Upload all selected files
  const uploadAllFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.info('No files selected for upload');
      return;
    }

    setUploading(true);
    const uploadedFiles = [];
    const failedFiles = [];

    for (const file of selectedFiles) {
      try {
        // Update file status to uploading
        setSelectedFiles(prev =>
          prev.map(f => f.id === file.id ? { ...f, uploadStatus: 'uploading' } : f)
        );
        
        // Set initial progress
        setUploadProgress(prev => ({ ...prev, [file.id]: 0 }));
        
        // Upload the file
        await uploadSingleFile(file);
        
        // Update progress to complete
        setUploadProgress(prev => ({ ...prev, [file.id]: 100 }));
        
        // Update file status
        setSelectedFiles(prev =>
          prev.map(f => f.id === file.id ? { ...f, uploadStatus: 'completed' } : f)
        );
        
        uploadedFiles.push(file);
        toast.success(`${file.name} uploaded successfully`);
        
      } catch (error) {
        // Update progress to failed
        setUploadProgress(prev => ({ ...prev, [file.id]: -1 }));
        
        // Update file status
        setSelectedFiles(prev =>
          prev.map(f => f.id === file.id ? { ...f, uploadStatus: 'failed' } : f)
        );
        
        failedFiles.push(file);
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    // Remove successfully uploaded files from the list after a delay
    setTimeout(() => {
      setSelectedFiles(prev => prev.filter(file => file.uploadStatus !== 'completed'));
      setUploadProgress({});
    }, 2000);

    // Refresh document list
    await loadCaseDocuments();
    
    // Call optional callback to notify parent component of changes
    if (onDocumentsChange) {
      onDocumentsChange();
    }
    
    // Show summary
    if (uploadedFiles.length > 0) {
      toast.success(`Successfully uploaded ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}`);
    }
    
    setUploading(false);
  };

  // Preview file from the selected list
  const previewSelectedFile = (fileWithMeta) => {
    // Use the original File object for preview, or fallback to fileWithMeta if it's already a File
    const originalFile = fileWithMeta.file || fileWithMeta;
    if (!demo) {
      handlePreviewDocument({ documentName: originalFile.name, documentType: originalFile.name.split('.').pop(), localFile: originalFile });
      return;
    }
    setPreviewingFile(originalFile);
    setShowFilePreview(true);
  };

  // Close file preview
  const closeFilePreview = () => {
    setShowFilePreview(false);
    setPreviewingFile(null);
  };

  // Delete document
  const handleDeleteDocument = async (documentId, documentName) => {


    if (!window.confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return;
    }

    try {
      await documentService.deleteDocument(documentId);
      toast.success('Document deleted successfully');
      await loadCaseDocuments();
      
      // Call optional callback to notify parent component of changes
      if (onDocumentsChange) {
        onDocumentsChange();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document: ' + error.message);
    }
  };

  // Download document
  const handleDownloadDocument = async (documentId, documentName) => {
    if (!demo) {
      handlePreviewDocument({ ...(documents.find(item => item.documentId === documentId) || { documentId, documentName }), downloadRequested: true });
      return;
    }
    try {
      await documentService.downloadDocument(documentId, documentName);
      toast.success('Download started successfully');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error(error.message || 'An unexpected error occurred while downloading the document');
    }
  };

  // Handle document preview
  const handlePreviewDocument = async (document) => {
    clearPhotoPreview();
    setSelectedDocument(document);
    setShowDocumentViewer(true);
    setDocumentContent(null);
    if (!demo) {
      setDocumentContent({ type: document.downloadRequested ? 'locked-download' : 'locked-preview' });
      setLoadingPreview(false);
      return;
    }
    setLoadingPreview(true);
    
    try {
      if (demo) {
        const file = await documentService.getDocumentFile();
        setDocumentContent({ type: 'pdf', url: URL.createObjectURL(file) });
        return;
      }
    } catch (error) {
      console.error('Error loading document preview:', error);
      toast.error('Failed to load document preview');
      setDocumentContent({ type: 'error', message: error.message });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCloseViewer = () => {
    clearPhotoPreview();
    setShowDocumentViewer(false);
    setSelectedDocument(null);
    setDocumentContent(null);
    setLoadingPreview(false);
    
    // Clean up any object URLs to prevent memory leaks
    if (documentContent && documentContent.url) {
      URL.revokeObjectURL(documentContent.url);
    }
  };

  const unlockPhotoPreview = async (event) => {
    event.preventDefault();
    if (loadingPreview || photoPin.length !== 4) return;
    photoRequest.current?.abort();
    const controller = new AbortController();
    photoRequest.current = controller;
    setLoadingPreview(true);
    setPhotoPinError('');
    try {
      if (selectedDocument.downloadRequested) {
        const downloaded = await documentService.downloadDocument(selectedDocument.documentId, selectedDocument.documentName, photoPin, controller.signal);
        if (controller.signal.aborted || !downloaded) return;
        toast.success('Download started successfully');
        handleCloseViewer();
        return;
      }
      if (selectedDocument.localFile) {
        await documentService.verifyPreviewPin(caseId, photoPin, controller.signal);
        if (controller.signal.aborted) return;
        setPreviewingFile(selectedDocument.localFile);
        setShowFilePreview(true);
        setShowDocumentViewer(false);
        setSelectedDocument(null);
        setDocumentContent(null);
        return;
      }
      const blob = await documentService.previewDocument(selectedDocument.documentId, photoPin, controller.signal);
      if (controller.signal.aborted) return;
      const fileType = selectedDocument.documentType?.toLowerCase();
      if (['txt', 'md'].includes(fileType)) {
        const content = await blob.text();
        if (!controller.signal.aborted) setDocumentContent({ type: 'text', content });
      } else if (['jpg', 'jpeg', 'png', 'gif', 'pdf'].includes(fileType)) {
        const url = URL.createObjectURL(blob);
        photoUrl.current = url;
        setDocumentContent({ type: fileType === 'pdf' ? 'pdf' : 'image', url });
      } else {
        setDocumentContent({ type: 'unsupported' });
      }
    } catch (error) {
      if (!controller.signal.aborted) setPhotoPinError(error.message);
    } finally {
      if (!controller.signal.aborted) {
        setPhotoPin('');
        setLoadingPreview(false);
      }
    }
  };

  const handleSummarizeDocument = async (document, force = false) => {
    setSummaryDocument(document);
    setSummaryError('');

    if (!force && documentSummaries[document.documentId]) return;

    setSummaryLoading(true);
    try {
      const result = await documentService.summarizeDocument(document.documentId);
      setDocumentSummaries(current => ({ ...current, [document.documentId]: result }));
    } catch (error) {
      console.error('Error summarizing document:', error);
      setSummaryError(error.message || 'Could not summarize this document');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Filter documents based on search and type
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.documentType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'ALL' || doc.documentType.toLowerCase() === filterType.toLowerCase();
    
    return matchesSearch && matchesFilter;
  });

  // Get unique file types for filter
  const uniqueTypes = [...new Set(documents.map(doc => doc.documentType))];

  if (!demo && (!pinAccess?.unlocked || pinAccess.caseId !== caseId)) {
    return (
      <section className="mx-auto max-w-md rounded-xl border bg-white p-8 text-center">
        <FileText className="mx-auto mb-4 h-10 w-10 text-blue-600" />
        <h2 className="text-xl font-semibold">Documents are locked</h2>
        {newPin && <div className="my-4 rounded-lg bg-blue-50 p-4" role="alert"><p>Save this PIN and share it with your client. It is shown once.</p><p className="my-3 font-mono text-3xl tracking-widest">{newPin}</p><button className="underline" onClick={() => setNewPin(null)}>I saved the PIN</button></div>}
        <p className="my-3 text-sm text-gray-600">Enter the four-digit case PIN shared by your lawyer to view, upload, download, or delete documents. Access lasts 15 minutes.</p>
        {pinAccess && !pinAccess.configured ? (
          <div><p className="text-sm text-amber-700">A PIN is generated when the lawyer accepts the case. Cases accepted before this feature need a one-time setup by the assigned lawyer.</p>{userRole === 'LAWYER' && <button disabled={unlocking} className="mt-4 rounded-lg bg-blue-600 p-3 text-white" onClick={setupExistingPin}>Set up document PIN</button>}</div>
        ) : (
          <form onSubmit={unlockDocuments} className="space-y-4">
            <label className="block text-sm font-medium" htmlFor="document-pin">Case document PIN</label>
            <input id="document-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} minLength={4} required value={pin} onChange={event => setPin(event.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-lg border p-3 text-center text-2xl tracking-widest" />
            <button disabled={unlocking || pin.length !== 4} className="w-full rounded-lg bg-blue-600 p-3 text-white disabled:opacity-50">{unlocking ? 'Unlocking…' : 'Unlock documents'}</button>
          </form>
        )}
        {pinError && <p role="alert" className="mt-3 text-sm text-red-600">{pinError}</p>}
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6">
        {demo && <div className="flex flex-wrap items-center justify-between gap-3 p-4 mb-6 border border-blue-100 rounded-lg bg-blue-50">
          <div><p className="text-sm font-semibold text-blue-900">Evaluation PDF: {SAMPLE_NAME}</p><p className="mt-1 text-xs text-blue-700">Download it, choose Select Files, then Upload All. Use Summarize on the uploaded document.</p></div>
          <a href={SAMPLE_PDF} download={SAMPLE_NAME} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-md"><Download className="w-4 h-4" />Download sample PDF</a>
        </div>}
        {/* Upload Section - Only for Clients and Lawyer */}
        {(userRole === 'CLIENT' || userRole === 'LAWYER') && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Drag and drop files here, or click to select files
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {demo ? 'Evaluation format: PDF (Max 10MB)' : 'Supported formats: PDF, DOC, DOCX, TXT, JPG, JPEG, PNG (Max 20MB each)'}
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="document-upload"
                accept={demo ? '.pdf,application/pdf' : '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png'}
                disabled={uploading}
              />
              <label
                htmlFor="document-upload"
                className={`inline-flex items-center px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  uploading 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Select Files'
                )}
              </label>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Selected Files ({selectedFiles.length})
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={clearAllFiles}
                      disabled={uploading}
                      className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                    <button
                      onClick={uploadAllFiles}
                      disabled={uploading || selectedFiles.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload All ({selectedFiles.length})
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {selectedFiles.filter(file => file && file.name && typeof file.size !== 'undefined').map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium text-gray-900 truncate">
                              {file.name}
                            </h5>
                            {file.uploadStatus === 'uploading' && (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            )}
                            {file.uploadStatus === 'completed' && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                            {file.uploadStatus === 'failed' && (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {file.size ? formatFileSize(file.size) : 'Unknown size'} • {file.name ? documentService.getFileType(file.name).toUpperCase() : 'Unknown'}
                          </p>
                          
                          {/* Upload Progress Bar */}
                          {uploadProgress[file.id] !== undefined && (
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  uploadProgress[file.id] === 100 ? 'bg-green-500' :
                                  uploadProgress[file.id] === -1 ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.max(0, uploadProgress[file.id])}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={() => previewSelectedFile(file)}
                          disabled={uploading}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                          title="Preview File"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFile(file.id)}
                          disabled={uploading || file.uploadStatus === 'uploading'}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove File"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Documents List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Documents ({filteredDocuments.length})
            </h3>
          </div>
          
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">
                {documents.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'}
              </p>
              {userRole === 'CLIENT' && documents.length === 0 && (
                <p className="text-sm text-gray-400">Upload documents to share them with your lawyer</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.documentId}
                  className="flex flex-col gap-3 p-4 border border-gray-200 rounded-lg transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer" onClick={() => handlePreviewDocument(doc)}>
                    <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-gray-900 truncate hover:text-blue-600 transition-colors">
                        {doc.documentName}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Uploaded at {documentService.formatDate(doc.uploadedAt)}
                        • Uploaded by  ({doc.uploaderRole === 'CLIENT' ? 'Client' : doc.uploaderRole === 'LAWYER' ? 'Lawyer' : doc.uploaderRole})

                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center self-end space-x-2 flex-shrink-0 sm:self-auto">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSummarizeDocument(doc);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
                      title={isSummarizableDocument(doc) ? 'Summarize document' : 'Summaries support PDF, DOC, DOCX, TXT, and MD files'}
                      disabled={!doc.documentId || !isSummarizableDocument(doc)}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Summarize</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewDocument(doc);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                      title="Preview"
                      disabled={!doc.documentId}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadDocument(doc.documentId, doc.documentName);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                      title="Download"
                      disabled={!doc.documentId}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    
                    {(
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.documentId, doc.documentName);
                        }}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                        title="Delete"
                        disabled={!doc.documentId}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {summaryDocument && (
        <SidePanel
          title="AI Document Summary"
          description={summaryDocument.documentName}
          busy={summaryLoading}
          onClose={() => setSummaryDocument(null)}
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <div className="p-3 text-sm text-blue-800 border border-blue-200 rounded-lg bg-blue-50">
              This summary is generated from the uploaded document. Verify important details against the original file.
            </div>

            {summaryLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                <p className="mt-4 font-medium text-gray-900">Reading and summarizing…</p>
                <p className="mt-1 text-sm text-gray-500">Long documents may take a little longer.</p>
              </div>
            ) : summaryError ? (
              <div className="p-4 mt-5 border border-red-200 rounded-lg bg-red-50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 text-red-600 shrink-0" />
                  <div>
                    <p className="font-medium text-red-900">Summary unavailable</p>
                    <p className="mt-1 text-sm text-red-700">{summaryError}</p>
                  </div>
                </div>
              </div>
            ) : documentSummaries[summaryDocument.documentId] ? (
              <div className="mt-5">
                {documentSummaries[summaryDocument.documentId].sourceTextTruncated && (
                  <p className="p-3 mb-4 text-sm text-amber-800 border border-amber-200 rounded-lg bg-amber-50">
                    This document exceeded the summary limit, so the summary uses its first section only.
                  </p>
                )}
                <MarkdownText
                  text={documentSummaries[summaryDocument.documentId].summary}
                  className="text-sm text-gray-700"
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 shrink-0">
            <button
              type="button"
              disabled={summaryLoading}
              onClick={() => handleSummarizeDocument(summaryDocument, true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 border border-violet-200 rounded-md hover:bg-violet-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin' : ''}`} />
              {summaryError ? 'Try again' : 'Regenerate'}
            </button>
            <button
              type="button"
              disabled={summaryLoading}
              onClick={() => setSummaryDocument(null)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </SidePanel>
      )}

      {/* Document Viewer Modal */}
      {showDocumentViewer && selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-6xl max-h-[95vh] w-full flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedDocument.documentName}</h3>
                <p className="text-sm text-gray-500">
                 {selectedDocument.localFile ? 'File selected for upload' : `Uploaded ${documentService.formatDate(selectedDocument.uploadedAt)}`}
                  {selectedDocument.uploaderName && selectedDocument.uploaderRole && (
                    <> • Uploaded by {selectedDocument.uploaderName} ({selectedDocument.uploaderRole === 'CLIENT' ? 'Client' : selectedDocument.uploaderRole === 'LAWYER' ? 'Lawyer' : selectedDocument.uploaderRole})</>
                  )}
                </p>
              </div>
              <button
                onClick={handleCloseViewer}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden p-4">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">Loading preview...</span>
                </div>
              ) : documentContent ? (
                <div className="h-full">
                  {['locked-preview', 'locked-download'].includes(documentContent.type) && (
                    <form onSubmit={unlockPhotoPreview} className="mx-auto max-w-sm space-y-4 py-8 text-center">
                      <Eye className="mx-auto h-10 w-10 text-blue-600" />
                      <h4 className="text-lg font-semibold">{selectedDocument.downloadRequested ? 'Unlock file download' : 'Unlock document preview'}</h4>
                      <p className="text-sm text-gray-600">Enter the same four-digit case PIN each time you {selectedDocument.downloadRequested ? 'download' : 'preview'} a file.</p>
                      <label htmlFor="photo-preview-pin" className="block text-sm font-medium">Case PIN</label>
                      <input autoFocus id="photo-preview-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" minLength={4} maxLength={4} required value={photoPin} onChange={event => setPhotoPin(event.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-lg border p-3 text-center text-2xl tracking-widest" />
                      {photoPinError && <p role="alert" className="text-sm text-red-600">{photoPinError}</p>}
                      <button disabled={photoPin.length !== 4 || loadingPreview} className="w-full rounded-lg bg-blue-600 p-3 text-white disabled:opacity-50">{selectedDocument.downloadRequested ? 'Download file' : 'View preview'}</button>
                    </form>
                  )}
                  {documentContent.type === 'image' && (
                    <div className="flex items-center justify-center h-full">
                      <img
                        src={documentContent.url}
                        alt={selectedDocument.documentName}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  
                  {documentContent.type === 'pdf' && (
                    <iframe
                      src={documentContent.url}
                      className="w-full h-full border-0 rounded"
                      title={selectedDocument.documentName}
                    />
                  )}
                  
                  {documentContent.type === 'text' && (
                    <div className="h-full overflow-auto">
                      <pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-gray-50 rounded h-full overflow-auto">
                        {documentContent.content}
                      </pre>
                    </div>
                  )}
                  
                  {documentContent.type === 'unsupported' && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <FileText className="w-16 h-16 mb-4 text-gray-400" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h4>
                      <p className="text-gray-600 mb-4">
                        Preview is not supported for {selectedDocument.documentType.toUpperCase()} files.
                      </p>
                      <button
                        onClick={() => handleDownloadDocument(selectedDocument.documentId, selectedDocument.documentName)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download File
                      </button>
                    </div>
                  )}
                  
                  {documentContent.type === 'error' && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <AlertCircle className="w-16 h-16 mb-4 text-red-400" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Error Loading Preview</h4>
                      <p className="text-gray-600 mb-4">{documentContent.message}</p>
                      <button
                        onClick={() => handleDownloadDocument(selectedDocument.documentId, selectedDocument.documentName)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Try Download Instead
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Click anywhere on the document name to preview • Use buttons to download or delete
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadDocument(selectedDocument.documentId, selectedDocument.documentName)}
                  disabled={!!selectedDocument.localFile || ['locked-preview', 'locked-download'].includes(documentContent?.type) || loadingPreview}
                  className="flex items-center gap-2 px-3 py-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handleCloseViewer}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {showFilePreview && previewingFile && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Preview: {previewingFile.name}</h3>
                <p className="text-sm text-gray-500">
                  {previewingFile.size ? formatFileSize(previewingFile.size) : 'Unknown size'} • {previewingFile.name ? documentService.getFileType(previewingFile.name).toUpperCase() : 'Unknown'}
                </p>
              </div>
              <button
                onClick={closeFilePreview}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden p-4">
              <FilePreview
                file={previewingFile}
                onPreviewGenerated={() => {}}
                onError={(error) => {
                  console.error('Preview error:', error);
                  toast.error('Failed to generate preview');
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="text-sm text-gray-600">
                File ready for upload • Use "Upload All" button to upload this file along with others
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => removeFile(previewingFile.id)}
                  className="flex items-center gap-2 px-3 py-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
                <button
                  onClick={closeFilePreview}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const isSummarizableDocument = document => {
  const type = String(document?.documentType || document?.documentName?.split('.').pop() || '').toLowerCase().replace('.', '');
  return ['pdf', 'doc', 'docx', 'txt', 'md'].includes(type);
};

export default CaseDocumentManager;
