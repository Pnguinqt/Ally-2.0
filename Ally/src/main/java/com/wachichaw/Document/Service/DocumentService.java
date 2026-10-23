package com.wachichaw.Document.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Bucket;
import com.google.firebase.cloud.StorageClient;
import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.User.Repo.UserRepo;
import com.wachichaw.Document.Entity.DocumentEntity;
import com.wachichaw.Document.Repo.DocumentRepo;

@Service
public class DocumentService {

    @Autowired
    private final DocumentRepo documentRepo;
    @Autowired
    private UserRepo userRepo;
    @Autowired
    private LegalCaseRepo legalCaseRepo;

    @Value("${storage.type:local}")
    private String storageType;

    @Value("${local.storage.path:../local-storage}")
    private String localStoragePath;

    // Allowed file types
    private static final String[] ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png"};
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    //private static final String UPLOAD_DIR = System.getProperty("user.dir") + "/src/main/resources/static/docs";

    public DocumentService(DocumentRepo documentRepo) {
        this.documentRepo = documentRepo;
    }

    /**
     * Get documents by case with access control validation
     */
    public List<DocumentEntity> getDocumentsByCase(int caseId, int userId, String userRole) {
        if (!validateCaseAccess(caseId, userId, userRole)) {
            throw new RuntimeException("Access denied: User does not have permission to access this case");
        }
        return documentRepo.findByLegalcaseEntityCaseId(caseId);
    }

    /**
     * Validate if user has access to the specified case
     */
    public boolean validateCaseAccess(int caseId, int userId, String userRole) {
        LegalCasesEntity legalCase = legalCaseRepo.findById(caseId)
            .orElseThrow(() -> new RuntimeException("Case not found"));

        switch (userRole.toUpperCase()) {
            case "CLIENT":
                // Clients can only access their own cases
                return legalCase.getClient().getUserId() == userId;
            case "LAWYER":
                // Lawyers can access cases assigned to them
                return legalCase.getLawyer() != null && legalCase.getLawyer().getUserId() == userId;
            case "ADMIN":
                // Admins can access all cases
                return true;
            default:
                return false;
        }
    }

    /**
     * Enhanced upload with case validation and security checks
     */
    public DocumentEntity uploadDocumentToCase(LegalCasesEntity legalCase, int userId,
                                             MultipartFile file, String documentName,
                                             String documentType, String status) throws IOException {
        
        // Validate case is ACCEPTED
        if (legalCase.getStatus() != CaseStatus.ACCEPTED) {
            throw new RuntimeException("Documents can only be uploaded to ACCEPTED cases");
        }

        // Validate user has access to this case (either client or assigned lawyer)
        boolean hasAccess = (legalCase.getClient().getUserId() == userId) ||
                           (legalCase.getLawyer() != null && legalCase.getLawyer().getUserId() == userId);
        
        if (!hasAccess) {
            throw new RuntimeException("User can only upload documents to their own cases or cases they are assigned to");
        }

        // Validate file type
        if (!isValidFileType(file.getOriginalFilename())) {
            throw new RuntimeException("File type not allowed. Allowed types: " + String.join(", ", ALLOWED_EXTENSIONS));
        }

        // Validate file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("File size exceeds maximum limit of 20MB");
        }

       String DocumentFileURL = storeDocumentFile(file);

        // Get user entity
        UserEntity user = userRepo.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found with ID: " + userId));

        // Create document entity
        DocumentEntity document = new DocumentEntity();
        document.setCaseEntity(legalCase);
        document.setUploadedBy(user);
        document.setDocumentName(documentName);
        document.setDocumentType(documentType);
        document.setUploadedAt(LocalDateTime.now());
        document.setFilePath(DocumentFileURL);
        document.setStatus(status);

        return documentRepo.save(document);
    }

    private boolean useFirebaseStorage() {
        return "firebase".equalsIgnoreCase(storageType);
    }

    private String storeDocumentFile(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }

        String originalName = Optional.ofNullable(file.getOriginalFilename()).orElse("document");
        String safeOriginalName = Paths.get(originalName).getFileName().toString();
        String fileName = UUID.randomUUID() + "_" + safeOriginalName;

        if (!useFirebaseStorage()) {
            Path uploadDir = Paths.get(localStoragePath, "documents").normalize();
            Files.createDirectories(uploadDir);
            Path target = uploadDir.resolve(fileName).normalize();
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return target.toString();
        }

        Bucket bucket = StorageClient.getInstance().bucket();
        Blob blob = bucket.create("documents/" + fileName,
                file.getBytes(),
                file.getContentType());

        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8.toString());
        return String.format(
                "https://firebasestorage.googleapis.com/v0/b/%s/o/documents%%2F%s?alt=media",
                bucket.getName(),
                encodedFileName
        );
    }

    /**
     * Legacy upload method - maintained for backward compatibility
     */
    public DocumentEntity uploadDocument(LegalCasesEntity legalCase, int userId, String documentName,
                                       String filePath, String documentType, LocalDateTime uploadedAt, String status) {
        UserEntity user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + userId));
        
        DocumentEntity document = new DocumentEntity();
        document.setCaseEntity(legalCase);
        document.setUploadedBy(user);
        document.setDocumentName(documentName);
        document.setDocumentType(documentType);
        document.setUploadedAt(uploadedAt);
        document.setFilePath(filePath);
        document.setStatus(status);
        return documentRepo.save(document);
    }

    /**
     * Retrieve document with access control
     */
    public DocumentEntity retrieveDocument(int documentId, int userId, String userRole) {
        DocumentEntity document = documentRepo.findById(documentId)
            .orElseThrow(() -> new RuntimeException("Document not found"));

        if (!validateDocumentAccess(document, userId, userRole)) {
            throw new RuntimeException("Access denied: User does not have permission to access this document");
        }

        return document;
    }

    /**
     * Read the stored bytes for a document after the caller has retrieved it
     * through the access-controlled path.
     */
    public byte[] readDocumentBytes(DocumentEntity document) throws IOException {
        String filePath = document.getFilePath();
        if (filePath == null || filePath.isBlank()) {
            throw new IOException("The stored file path is missing.");
        }

        if (!useFirebaseStorage()) {
            Path localPath = Paths.get(filePath).normalize();
            if (!Files.exists(localPath) || !Files.isRegularFile(localPath)) {
                throw new IOException("The stored file could not be found.");
            }
            return Files.readAllBytes(localPath);
        }

        int objectStart = filePath.indexOf("/o/");
        int queryStart = filePath.indexOf("?alt=media");
        if (objectStart < 0 || queryStart <= objectStart + 3) {
            throw new IOException("The stored file URL is invalid.");
        }

        String encodedBlobName = filePath.substring(objectStart + 3, queryStart);
        String blobName = java.net.URLDecoder.decode(encodedBlobName, StandardCharsets.UTF_8);
        Blob blob = StorageClient.getInstance().bucket().get(blobName);
        if (blob == null || !blob.exists()) {
            throw new IOException("The stored file could not be found.");
        }
        return blob.getContent();
    }

    /**
     * Delete document with access control
     */
    public boolean deleteDocument(int documentId, int userId, String userRole) {
        DocumentEntity document = documentRepo.findById(documentId)
            .orElseThrow(() -> new RuntimeException("Document not found"));

        if (!validateDocumentAccess(document, userId, userRole)) {
            throw new RuntimeException("Access denied: User does not have permission to delete this document");
        }

        try {
            String fileUrl = document.getFilePath();
            if (fileUrl != null && !fileUrl.isEmpty()) {
                if (!useFirebaseStorage()) {
                    Files.deleteIfExists(Paths.get(fileUrl));
                } else {
                    // Extract file name from URL
                    String blobName = fileUrl.substring(fileUrl.indexOf("/o/") + 3, fileUrl.indexOf("?alt=media"));
                    String decodedBlobName = java.net.URLDecoder.decode(blobName, StandardCharsets.UTF_8.toString());

                    Bucket bucket = StorageClient.getInstance().bucket();
                    Blob blob = bucket.get(decodedBlobName);
                    
                    if (blob != null && blob.exists()) {
                        blob.delete();
                    }
                }
            }

            documentRepo.delete(document);
            return true;
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete document: " + e.getMessage());
        }
    }

    /**
     * Get document count for case
     */
    public int getDocumentCountForCase(int caseId) {
        return documentRepo.countByLegalcaseEntityCaseId(caseId);
    }

    /**
     * Validate document access for specific operations
     */
    private boolean validateDocumentAccess(DocumentEntity document, int userId, String userRole) {
        LegalCasesEntity legalCase = document.getCaseEntity();
        
        switch (userRole.toUpperCase()) {
            case "CLIENT":
                // Clients can access documents from their own cases
                return legalCase.getClient().getUserId() == userId;
            case "LAWYER":
                // Lawyers can access documents from their assigned cases
                return legalCase.getLawyer() != null && legalCase.getLawyer().getUserId() == userId;
            case "ADMIN":
                // Admins can access all documents
                return true;
            default:
                return false;
        }
    }

    /**
     * Validate file type against allowed extensions
     */
    private boolean isValidFileType(String filename) {
        if (filename == null || filename.isEmpty()) {
            return false;
        }
        
        String extension = filename.toLowerCase();
        for (String allowedExt : ALLOWED_EXTENSIONS) {
            if (extension.endsWith(allowedExt)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get documents by lawyer ID
     */
    public List<DocumentEntity> getDocumentsByLawyer(int lawyerId) {
        return documentRepo.findDocumentsByLawyerId(lawyerId);
    }

    /**
     * Get documents by client and case
     */
    public List<DocumentEntity> getDocumentsByClientAndCase(int clientId, int caseId) {
        return documentRepo.findByUploadedByUserIdAndLegalcaseEntityCaseId(clientId, caseId);
    }
}
