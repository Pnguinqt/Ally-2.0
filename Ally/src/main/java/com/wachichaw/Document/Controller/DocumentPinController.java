package com.wachichaw.Document.Controller;

import java.util.Map;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.Document.Service.DocumentPinService;

@RestController
@RequestMapping("/api/documents/case/{caseId}/pin")
public class DocumentPinController {
    private final DocumentPinService pins;
    public DocumentPinController(DocumentPinService pins) { this.pins = pins; }
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public org.springframework.http.ResponseEntity<?> failure(org.springframework.web.server.ResponseStatusException error) {
        return org.springframework.http.ResponseEntity.status(error.getStatusCode()).body(Map.of("message", error.getReason() == null ? "Access denied" : error.getReason()));
    }
    @PostMapping("/setup")
    public Map<String, String> setup(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor) {
        return Map.of("pin", pins.initializeExistingCase(caseId, actor.getUserId()));
    }
    @PostMapping("/verify")
    public Map<String, Boolean> verifyPreview(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Map<String, String> body) {
        if (!pins.unlocked(caseId, actor.getUserId(), session))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.LOCKED, "Unlock case documents first");
        pins.verifyPin(caseId, actor.getUserId(), body.get("pin"));
        return Map.of("verified", true);
    }
    @GetMapping
    public Map<String, Object> status(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session) {
        var c = pins.participant(caseId, actor.getUserId());
        return Map.of("unlocked", pins.unlocked(caseId, actor.getUserId(), session), "configured", c.getDocumentPinHash() != null,
            "expiresAt", pins.expiresAt(caseId, actor.getUserId(), session));
    }
    @PostMapping
    public Map<String, Object> unlock(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor,
            @RequestHeader("Authorization") String session, @RequestBody Map<String, String> body) {
        pins.unlock(caseId, actor.getUserId(), session, body.get("pin"));
        return Map.of("unlocked", true, "configured", true, "expiresAt", pins.expiresAt(caseId, actor.getUserId(), session));
    }
}
