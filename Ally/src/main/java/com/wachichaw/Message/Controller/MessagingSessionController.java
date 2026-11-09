package com.wachichaw.Message.Controller;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.User.Entity.UserEntity;
import io.jsonwebtoken.JwtException;

@RestController
@RequestMapping("/api/messaging/session")
public class MessagingSessionController {
    private final FirebaseApp firebase;
    private final JwtUtil jwt;

    public MessagingSessionController(FirebaseApp firebase, JwtUtil jwt) {
        this.firebase = firebase;
        this.jwt = jwt;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> create(@AuthenticationPrincipal UserEntity actor,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        if (actor == null || actor.getAccountType() == null || authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to use messaging.");
        }
        try {
            String allyToken = authorization.substring(7);
            String userId = Integer.toString(actor.getUserId());
            if (!userId.equals(jwt.extractUserId(allyToken))) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to use messaging.");
            }
            String token = FirebaseAuth.getInstance(firebase).createCustomToken(userId,
                Map.of("allyMessagingExpiresAt", jwt.extractExpirationMillis(allyToken), "allyRole", actor.getAccountType().name()));
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("token", token));
        } catch (JwtException | IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to use messaging.");
        } catch (FirebaseAuthException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to connect to messaging.", error);
        }
    }
}
