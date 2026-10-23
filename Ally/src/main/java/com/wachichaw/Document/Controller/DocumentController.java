package com.wachichaw.Document.Controller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Bucket;
import com.google.firebase.cloud.StorageClient;
import com.wachichaw.Audit.Service.AuditLogService;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.Document.Entity.DocumentEntity;
import com.wachichaw.Document.Entity.DocumentDTO;
import com.wachichaw.Document.Service.DocumentService;
import com.wachichaw.Document.Service.DocumentSummaryService;
import com.wachichaw.Document.Service.DocumentSummaryService.UnreadableDocumentException;
import com.wachichaw.Document.Service.DocumentSummaryService.UnsupportedDocumentTypeException;
import com.wachichaw.User.Repo.UserRepo;

import jakarta.servlet.http.HttpServletRequest;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    @Autowired
    private final DocumentService documentService;
    @Autowired
    private UserRepo userRepo;
    @Autowired
    private LegalCaseRepo legalCaseRepo;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private AuditLogService auditLogService;
    @Autowired
    private DocumentSummaryService documentSummaryService;

    @Value("${storage.type:local}")
    private String storageType;
    
    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    /**
     * Get documents for a specific case with access control
     */
    @GetMapping("/case/{caseId}")
    public ResponseEntity<?> getCaseDocuments(
            @PathVariable int caseId,
            HttpServletRequest request) {
        try {
            // Extract user info from JWT token
            String[] userInfo = extractUserFromRequest(request);
            int userId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            List<DocumentEntity> documents = documentService.getDocumentsByCase(caseId, userId, userRole);
            
            // Convert to DTOs for clean API response
            List<DocumentDTO> documentDTOs = documents.stream()
                .map(DocumentDTO::new)
                .collect(Collectors.toList());
            
            return ResponseEntity.ok(documentDTOs);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body("Access denied: " + e.getMessage());
        }
    }

    /**
     * Get document count for a case
     */
    @GetMapping("/case/{caseId}/count")
    public ResponseEntity<?> getCaseDocumentCount(
            @PathVariable int caseId,
            HttpServletRequest request) {
        try {
            // Extract user info from JWT token
            String[] userInfo = extractUserFromRequest(request);
            int userId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            // Validate access to case
            if (!documentService.validateCaseAccess(caseId, userId, userRole)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied: User does not have permission to access this case");
            }

            int count = documentService.getDocumentCountForCase(caseId);
            return ResponseEntity.ok(count);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body("Access denied: " + e.getMessage());
        }
    }

    /**
     * Enhanced upload with case validation and security
     */
    @PostMapping("/upload/{userId}")
    public ResponseEntity<?> uploadDocument(
            @PathVariable int userId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("caseId") int caseId,
            @RequestParam("documentName") String documentName,
            @RequestParam("documentType") String documentType,
            @RequestParam("status") String status,
            HttpServletRequest request) {
        try {
            // Extract user info from JWT token to verify authorization
            String[] userInfo = extractUserFromRequest(request);
            int tokenUserId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            // Ensure the user can only upload for themselves
            if (tokenUserId != userId) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied: Cannot upload documents for another user");
            }

            // Ensure only clients and lawyers can upload documents
            if (!"CLIENT".equals(userRole) && !"LAWYER".equals(userRole)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied: Only clients and lawyers can upload documents");
            }

            LegalCasesEntity legalCase = legalCaseRepo.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found"));

            // Upload document with enhanced validation
            DocumentEntity document = documentService.uploadDocumentToCase(
                legalCase, userId, file, documentName, documentType, status);

            auditLogService.log(userId, "UPLOAD_DOCUMENT", "DOCUMENT", "DOCUMENT",
                String.valueOf(document.getDocument_id()),
                "Uploaded document '" + documentName + "' to case #" + caseId, "SUCCESS");

            DocumentDTO documentDTO = new DocumentDTO(document);
            return ResponseEntity.ok(documentDTO);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Upload failed: " + e.getMessage());
        }
    }

    /**
     * Delete document with authorization
     */
    @DeleteMapping("/{documentId}")
    public ResponseEntity<?> deleteDocument(
            @PathVariable int documentId,
            HttpServletRequest request) {
        try {
            // Extract user info from JWT token
            String[] userInfo = extractUserFromRequest(request);
            int userId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            boolean deleted = documentService.deleteDocument(documentId, userId, userRole);
            
            if (deleted) {
                auditLogService.log(userId, "DELETE_DOCUMENT", "DOCUMENT", "DOCUMENT",
                    String.valueOf(documentId), "Deleted document #" + documentId, "SUCCESS");
                return ResponseEntity.ok("Document deleted successfully");
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to delete document");
            }

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body("Delete failed: " + e.getMessage());
        }
    }

    /**
     * Download document with access control
     */
    @GetMapping("/{documentId}/download")
    public ResponseEntity<?> downloadDocument(
            @PathVariable int documentId,
            HttpServletRequest request) {
        try {
            // Extract user info from JWT token
            String[] userInfo = extractUserFromRequest(request);
            int userId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            // Retrieve document with access validation
            DocumentEntity document = documentService.retrieveDocument(documentId, userId, userRole);

            // Prepare file for download from Firebase Storage
            String fileUrl = document.getFilePath();
            if (fileUrl == null || fileUrl.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("File URL not found");
            }

            try {
                if (!"firebase".equalsIgnoreCase(storageType)) {
                    Path localPath = Paths.get(fileUrl).normalize();
                    if (!Files.exists(localPath)) {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("File not found in local storage");
                    }

                    byte[] fileContent = Files.readAllBytes(localPath);
                    String contentType = Files.probeContentType(localPath);
                    if (contentType == null) {
                        contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
                    }

                    InputStreamResource resource = new InputStreamResource(
                        new java.io.ByteArrayInputStream(fileContent));

                    return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + document.getDocumentName() + "\"")
                        .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(fileContent.length))
                        .body(resource);
                }

                // Extract file name from URL for Firebase Storage access
                String blobName;
                if (fileUrl.contains("/o/")) {
                    // Extract blob name from Firebase Storage URL
                    blobName = fileUrl.substring(fileUrl.indexOf("/o/") + 3, fileUrl.indexOf("?alt=media"));
                    blobName = java.net.URLDecoder.decode(blobName, StandardCharsets.UTF_8.toString());
                } else {
                    // Fallback: assume the URL contains the path directly
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Invalid file URL format");
                }

                // Get the file from Firebase Storage using Admin SDK
                Bucket bucket = StorageClient.getInstance().bucket();
                Blob blob = bucket.get(blobName);
                
                if (blob == null || !blob.exists()) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("File not found in storage");
                }

                // Get file content as byte array
                byte[] fileContent = blob.getContent();
                
                // Determine content type
                String contentType = blob.getContentType();
                if (contentType == null) {
                    contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
                }

                // Create InputStreamResource from byte array
                InputStreamResource resource = new InputStreamResource(
                    new java.io.ByteArrayInputStream(fileContent));

                return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + document.getDocumentName() + "\"")
                    .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(fileContent.length))
                    .body(resource);
                    
            } catch (Exception e) {
                // Handle cases where the file cannot be accessed from Firebase Storage
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to download file: " + e.getMessage());
            }

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body("Download failed: " + e.getMessage());
        }
    }

    /**
     * Get document details by ID
     */
    @GetMapping("/{documentId}")
    public ResponseEntity<?> getDocument(
            @PathVariable int documentId,
            HttpServletRequest request) {
        try {
            // Extract user info from JWT token
            String[] userInfo = extractUserFromRequest(request);
            int userId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            DocumentEntity document = documentService.retrieveDocument(documentId, userId, userRole);
            DocumentDTO documentDTO = new DocumentDTO(document);
            return ResponseEntity.ok(documentDTO);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body("Access denied: " + e.getMessage());
        }
    }

    /**
     * Generate an on-demand AI summary after validating case access.
     */
    @PostMapping("/{documentId}/summary")
    public ResponseEntity<?> summarizeDocument(
            @PathVariable int documentId,
            HttpServletRequest request) {
        try {
            String[] userInfo = extractUserFromRequest(request);
            int userId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            var summary = documentSummaryService.summarize(documentId, userId, userRole);
            auditLogService.log(userId, "SUMMARIZE_DOCUMENT", "DOCUMENT", "DOCUMENT",
                String.valueOf(documentId), "Generated an AI summary for document #" + documentId, "SUCCESS");
            return ResponseEntity.ok(summary);
        } catch (UnsupportedDocumentTypeException exception) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(Map.of("message", exception.getMessage()));
        } catch (UnreadableDocumentException exception) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("message", exception.getMessage()));
        } catch (IllegalStateException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", exception.getMessage()));
        } catch (Exception exception) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", "You do not have permission to summarize this document."));
        }
    }

    /**
     * Get documents by client and case
     */
    @GetMapping("/client/{clientId}/case/{caseId}")
    public ResponseEntity<?> getDocumentsByClientAndCase(
            @PathVariable int clientId,
            @PathVariable int caseId,
            HttpServletRequest request) {
        try {
            // Extract user info from JWT token
            String[] userInfo = extractUserFromRequest(request);
            int userId = Integer.parseInt(userInfo[0]);
            String userRole = userInfo[1];

            // Validate access
            if (!documentService.validateCaseAccess(caseId, userId, userRole)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied: User does not have permission to access this case");
            }

            List<DocumentEntity> documents = documentService.getDocumentsByClientAndCase(clientId, caseId);
            
            // Convert to DTOs for clean API response
            List<DocumentDTO> documentDTOs = documents.stream()
                .map(DocumentDTO::new)
                .collect(Collectors.toList());
            
            return ResponseEntity.ok(documentDTOs);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body("Access denied: " + e.getMessage());
        }
    }

    /**
     * Legacy upload endpoint - maintained for backward compatibility
     * Updated to use new request mapping structure
     */
    @PostMapping("/legacy/upload/{userId}")
    public ResponseEntity<DocumentEntity> legacyUploadDocument(
            @PathVariable int userId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("caseId") int caseId,
            @RequestParam("documentName") String documentName,
            @RequestParam("documentType") String documentType,
            @RequestParam("status") String status
    ) throws java.io.IOException {
        try {
            LegalCasesEntity legalCase = legalCaseRepo.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found"));
            
            String uploadDir = System.getProperty("user.dir") + "/src/main/resources/static/docs";
            Files.createDirectories(Paths.get(uploadDir));
            String uniqueFileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path filePath = Paths.get(uploadDir, uniqueFileName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            String relativePath = "/static/docs/" + uniqueFileName;

            DocumentEntity document = documentService.uploadDocument(
                legalCase,
                userId,
                documentName,
                relativePath,
                documentType,
                LocalDateTime.now(),
                status
            );

            return ResponseEntity.ok(document);

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Extract user information from JWT token in request
     */
    private String[] extractUserFromRequest(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }

        String token = authHeader.substring(7);
        String userId = jwtUtil.extractUserId(token);
        String accountType = jwtUtil.extractAccountType(token);

        if (userId == null || accountType == null) {
            throw new RuntimeException("Invalid token: missing user information");
        }

        return new String[]{userId, accountType};
    }
}

