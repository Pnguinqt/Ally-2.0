package com.wachichaw.Document.Controller;

import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.wachichaw.Document.Service.DocumentService;
import com.wachichaw.Document.Service.DocumentPinService;
import com.wachichaw.User.Entity.UserEntity;

@RestController
@RequestMapping("/api/documents")
public class DocumentPreviewController {
    private final DocumentService documents;
    private final DocumentPinService pins;
    public DocumentPreviewController(DocumentService documents, DocumentPinService pins) {
        this.documents = documents;
        this.pins = pins;
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> failure(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).cacheControl(CacheControl.noStore())
            .body(Map.of("message", error.getReason() == null ? "Access denied" : error.getReason()));
    }
    @PostMapping("/{documentId}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable int documentId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Map<String, String> body) throws IOException {
        return transfer(documentId, actor, session, body, false);
    }
    @PostMapping("/{documentId}/download")
    public ResponseEntity<byte[]> download(@PathVariable int documentId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Map<String, String> body) throws IOException {
        return transfer(documentId, actor, session, body, true);
    }
    private ResponseEntity<byte[]> transfer(int documentId, UserEntity actor, String session,
            Map<String, String> body, boolean download) throws IOException {
        var document = documents.retrieveDocument(documentId, actor.getUserId(), actor.getAccountType().toString());
        int caseId = document.getCaseEntity().getCaseId();
        if (!pins.unlocked(caseId, actor.getUserId(), session))
            throw new ResponseStatusException(HttpStatus.LOCKED, "Unlock case documents first");
        String type = document.getDocumentType() == null ? "" : document.getDocumentType().toLowerCase(Locale.ROOT);
        String contentType = switch (type) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "pdf" -> "application/pdf";
            case "txt", "md" -> "text/plain;charset=UTF-8";
            case "doc" -> "application/msword";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            default -> MediaType.APPLICATION_OCTET_STREAM_VALUE;
        };
        pins.verifyPin(caseId, actor.getUserId(), body.get("pin"));
        var response = ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            .contentType(MediaType.parseMediaType(contentType));
        if (download) response.header(HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(document.getDocumentName() == null ? "document" : document.getDocumentName(),
                java.nio.charset.StandardCharsets.UTF_8).build().toString());
        return response.body(documents.readDocumentBytes(document));
    }
}
