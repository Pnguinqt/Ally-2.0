package com.wachichaw.Case.Controller;

import java.util.Map;
import com.wachichaw.Case.DTO.CaseDraftRequest;
import com.wachichaw.Case.DTO.CaseDraftResponse;
import com.wachichaw.Case.Service.CaseDraftService;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Repo.UserRepo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class CaseDraftController {
    private final CaseDraftService drafts;
    private final JwtUtil jwt;
    private final UserRepo users;
    @Value("${demo.enabled:true}")
    private boolean demoEnabled;

    public CaseDraftController(CaseDraftService drafts, JwtUtil jwt, UserRepo users) {
        this.drafts = drafts; this.jwt = jwt; this.users = users;
    }

    @PostMapping("/cases/draft-assist")
    public CaseDraftResponse draft(@RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody CaseDraftRequest request) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to use the case writing assistant.");
        }
        com.wachichaw.User.Entity.UserEntity user;
        try {
            int id = Integer.parseInt(jwt.extractUserId(authorization.substring(7)));
            user = users.findById(id).orElseThrow();
        } catch (RuntimeException invalidToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again to use the case writing assistant.");
        }
        if (user.getAccountType() != AccountType.CLIENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The case writing assistant is available to clients submitting their case.");
        }
        return drafts.draft(request);
    }

    @PostMapping("/demo/case-draft")
    public CaseDraftResponse demoDraft(@RequestBody CaseDraftRequest request) {
        if (!demoEnabled) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Demo is unavailable.");
        // Transient drafting: no case, history, or production account records are written.
        return drafts.draft(request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> error(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("message", error.getReason()));
    }
}
