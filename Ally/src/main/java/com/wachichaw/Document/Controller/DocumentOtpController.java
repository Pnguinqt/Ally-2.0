package com.wachichaw.Document.Controller;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.wachichaw.Document.Service.DocumentOtpService;
import com.wachichaw.Document.Service.DocumentOtpService.Action;
import com.wachichaw.Document.Service.DocumentOtpService.Scope;
import com.wachichaw.User.Entity.UserEntity;

@RestController
@RequestMapping("/api/documents/case/{caseId}/otp")
public class DocumentOtpController {
    public record Code(String otp) {}

    private final DocumentOtpService otp;

    public DocumentOtpController(DocumentOtpService otp) {
        this.otp = otp;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> status(@PathVariable int caseId,
            @AuthenticationPrincipal UserEntity actor, @RequestHeader("Authorization") String session) {
        long expiresAt = otp.accessExpiresAt(caseId, actor, session);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(Map.of("unlocked", expiresAt > 0, "expiresAt", expiresAt));
    }

    @PostMapping("/request")
    public ResponseEntity<Map<String, Long>> requestUnlock(@PathVariable int caseId,
            @AuthenticationPrincipal UserEntity actor) {
        return sent(otp.requestCode(new Scope(caseId, null, Action.UNLOCK), actor));
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> unlock(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Code body) {
        long expiresAt = otp.unlock(caseId, actor, session, body.otp());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(Map.of("unlocked", true, "expiresAt", expiresAt));
    }

    @PostMapping("/local-preview/request")
    public ResponseEntity<Map<String, Long>> requestLocalPreview(@PathVariable int caseId,
            @AuthenticationPrincipal UserEntity actor, @RequestHeader("Authorization") String session) {
        otp.requireWorkspaceAccess(caseId, actor, session);
        return sent(otp.requestCode(new Scope(caseId, null, Action.LOCAL_PREVIEW), actor));
    }

    @PostMapping("/local-preview/verify")
    public ResponseEntity<Void> verifyLocalPreview(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Code body) {
        otp.requireWorkspaceAccess(caseId, actor, session);
        otp.verifyCode(new Scope(caseId, null, Action.LOCAL_PREVIEW), actor, body.otp());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    static ResponseEntity<Map<String, Long>> sent(long expiresAt) {
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(Map.of("expiresAt", expiresAt));
    }
}

@RestControllerAdvice(assignableTypes = {DocumentOtpController.class, DocumentPreviewController.class})
class DocumentOtpErrors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> failure(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).headers(error.getHeaders()).cacheControl(CacheControl.noStore())
            .body(Map.of("message", error.getReason() == null ? "Access denied" : error.getReason()));
    }
}
