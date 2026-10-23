package com.wachichaw.Hearing.Controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.wachichaw.Config.JwtUtil;
import com.wachichaw.Hearing.DTO.HearingRequest;
import com.wachichaw.Hearing.DTO.HearingResponse;
import com.wachichaw.Hearing.Service.HearingService;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.User.Repo.UserRepo;

@RestController
@RequestMapping("/api/cases/{caseId}/hearings")
public class HearingController {
    private final HearingService service;
    private final JwtUtil jwt;
    private final UserRepo users;

    public HearingController(HearingService service, JwtUtil jwt, UserRepo users) {
        this.service = service;
        this.jwt = jwt;
        this.users = users;
    }

    @GetMapping
    public List<HearingResponse> list(@PathVariable int caseId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return service.list(caseId, authenticate(authorization));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HearingResponse book(@PathVariable int caseId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody HearingRequest request) {
        return service.book(caseId, authenticate(authorization), request);
    }

    private UserEntity authenticate(String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            try {
                // JwtUtil verifies the signature and expiry; use the current database role for authorization.
                int userId = Integer.parseInt(jwt.extractUserId(authorization.substring(7)));
                return users.findById(userId).orElseThrow();
            } catch (RuntimeException invalidToken) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again to access hearings");
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to access hearings");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("message", error.getReason()));
    }
}
