package com.wachichaw.Document.Controller;

import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.wachichaw.Document.Controller.DocumentOtpController.Code;
import com.wachichaw.Document.Service.DocumentService;
import com.wachichaw.Document.Service.DocumentOtpService;
import com.wachichaw.Document.Service.DocumentOtpService.Action;
import com.wachichaw.Document.Service.DocumentOtpService.Scope;
import com.wachichaw.User.Entity.UserEntity;

@RestController
@RequestMapping("/api/documents")
public class DocumentPreviewController {
    private final DocumentService documents;
    private final DocumentOtpService otp;
    public DocumentPreviewController(DocumentService documents, DocumentOtpService otp) {
        this.documents = documents;
        this.otp = otp;
    }

    @PostMapping("/{documentId}/{operation:preview|download}/otp")
    public ResponseEntity<Map<String, Long>> requestCode(@PathVariable int documentId, @PathVariable String operation,
            @AuthenticationPrincipal UserEntity actor, @RequestHeader("Authorization") String session) {
        var document = documents.retrieveDocument(documentId, actor.getUserId(), String.valueOf(actor.getAccountType()));
        int caseId = document.getCaseEntity().getCaseId();
        otp.requireWorkspaceAccess(caseId, actor, session);
        Action action = "download".equals(operation) ? Action.DOWNLOAD : Action.PREVIEW;
        return DocumentOtpController.sent(otp.requestCode(new Scope(caseId, documentId, action), actor));
    }

    @PostMapping("/{documentId}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable int documentId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Code body) throws IOException {
        return transfer(documentId, actor, session, body.otp(), Action.PREVIEW);
    }
    @PostMapping("/{documentId}/download")
    public ResponseEntity<byte[]> download(@PathVariable int documentId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Code body) throws IOException {
        return transfer(documentId, actor, session, body.otp(), Action.DOWNLOAD);
    }

    private ResponseEntity<byte[]> transfer(int documentId, UserEntity actor, String session,
            String code, Action action) throws IOException {
        var document = documents.retrieveDocument(documentId, actor.getUserId(), String.valueOf(actor.getAccountType()));
        int caseId = document.getCaseEntity().getCaseId();
        otp.requireWorkspaceAccess(caseId, actor, session);
        otp.verifyCode(new Scope(caseId, documentId, action), actor, code);
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
        var response = ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            .contentType(MediaType.parseMediaType(contentType));
        if (action == Action.DOWNLOAD) response.header(HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(document.getDocumentName() == null ? "document" : document.getDocumentName(),
                java.nio.charset.StandardCharsets.UTF_8).build().toString());
        return response.body(documents.readDocumentBytes(document));
    }
}
