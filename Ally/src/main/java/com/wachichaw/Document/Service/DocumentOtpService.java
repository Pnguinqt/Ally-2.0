package com.wachichaw.Document.Service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.EmailConfig.Service.EmailDeliveryException;
import com.wachichaw.EmailConfig.Service.EmailService;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;

@Service
public class DocumentOtpService {
    private static final Duration OTP_LIFETIME = Duration.ofMinutes(5);
    private static final Duration WORKSPACE_ACCESS = Duration.ofMinutes(15);
    private static final Duration SEND_WINDOW = Duration.ofMinutes(1);
    private static final int SEND_LIMIT = 6;
    private static final int MAX_ATTEMPTS = 5;

    public enum Action {
        UNLOCK("open the document workspace"),
        LOCAL_PREVIEW("preview the file selected for upload"),
        PREVIEW("preview document"),
        DOWNLOAD("download document");

        private final String description;

        Action(String description) {
            this.description = description;
        }
    }

    public record Scope(int caseId, Integer documentId, Action action) {}
    private record ChallengeKey(int userId, Scope scope) {}
    private record GrantKey(int userId, int caseId, String session) {}
    private record Challenge(String code, Instant expiresAt, int attempts, boolean delivered) {}

    private final LegalCaseRepo cases;
    private final EmailService email;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    private final Map<ChallengeKey, Challenge> challenges = new HashMap<>();
    private final Map<String, Instant> recentCodes = new HashMap<>();
    private final Map<Integer, ArrayDeque<Instant>> sendsByUser = new HashMap<>();
    private final Map<GrantKey, Instant> grants = new HashMap<>();

    @Autowired
    public DocumentOtpService(LegalCaseRepo cases, EmailService email) {
        this(cases, email, Clock.systemUTC());
    }

    DocumentOtpService(LegalCaseRepo cases, EmailService email, Clock clock) {
        this.cases = cases;
        this.email = email;
        this.clock = clock;
    }

    public long requestCode(Scope scope, UserEntity actor) {
        authorize(scope.caseId(), actor);
        // JwtRequestFilter loads this principal from UserRepo on every authenticated request.
        String recipient = actor.getEmail();
        if (recipient == null || recipient.isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Your account needs a registered email address");
        }
        var key = new ChallengeKey(actor.getUserId(), scope);
        var challenge = reserveCode(key);
        try {
            String action = scope.action().description
                + (scope.documentId() == null ? "" : " #" + scope.documentId());
            email.sendEmail(recipient, "Your ALLY document access code",
                "<p>Use this code to " + action + " in case #" + scope.caseId() + ":</p>"
                + "<p><strong>" + challenge.code() + "</strong></p>"
                + "<p>The code expires 5 minutes after it was requested and can be used once.</p>");
        } catch (EmailDeliveryException exception) {
            synchronized (this) {
                challenges.remove(key, challenge);
            }
            String message = exception instanceof EmailDeliveryException.NotConfigured
                ? "Document email delivery is not configured. Contact support for help."
                : "Could not send the code. Try again shortly";
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
        }

        synchronized (this) {
            if (challenges.get(key) != challenge || !challenge.expiresAt().isAfter(clock.instant())) {
                challenges.remove(key, challenge);
                throw new ResponseStatusException(HttpStatus.GONE, "The code expired during delivery. Request a new code");
            }
            challenges.put(key, new Challenge(challenge.code(), challenge.expiresAt(), 0, true));
        }
        return challenge.expiresAt().toEpochMilli();
    }

    private synchronized Challenge reserveCode(ChallengeKey key) {
        Instant now = clock.instant();
        challenges.values().removeIf(challenge -> !challenge.expiresAt().isAfter(now));
        recentCodes.values().removeIf(expiry -> !expiry.isAfter(now));
        Instant cutoff = now.minus(SEND_WINDOW);
        sendsByUser.values().removeIf(sends -> {
            while (!sends.isEmpty() && !sends.peekFirst().isAfter(cutoff)) sends.removeFirst();
            return sends.isEmpty();
        });

        var prior = challenges.get(key);
        if (prior != null && !prior.delivered()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A code is already being sent. Try again shortly");
        }
        var sends = sendsByUser.computeIfAbsent(key.userId(), userId -> new ArrayDeque<>());
        if (sends.size() >= SEND_LIMIT) {
            Duration wait = Duration.between(now, sends.peekFirst().plus(SEND_WINDOW));
            long retryAfter = wait.toSeconds() + (wait.getNano() == 0 ? 0 : 1);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many code requests. Try again in " + retryAfter + " seconds") {
                @Override
                public HttpHeaders getHeaders() {
                    var headers = new HttpHeaders();
                    headers.set(HttpHeaders.RETRY_AFTER, Long.toString(retryAfter));
                    return headers;
                }
            };
        }
        sends.addLast(now);
        String code;
        do {
            code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
        } while (recentCodes.containsKey(code));
        Instant expiresAt = clock.instant().plus(OTP_LIFETIME);
        recentCodes.put(code, expiresAt);
        var challenge = new Challenge(code, expiresAt, 0, false);
        challenges.put(key, challenge);
        return challenge;
    }

    public void verifyCode(Scope scope, UserEntity actor, String code) {
        authorize(scope.caseId(), actor);
        consumeCode(new ChallengeKey(actor.getUserId(), scope), code);
    }

    private synchronized void consumeCode(ChallengeKey key, String code) {
        var challenge = challenges.get(key);
        if (challenge == null || !challenge.expiresAt().isAfter(clock.instant())) {
            challenges.remove(key);
            throw new ResponseStatusException(HttpStatus.GONE, "Request a new code to continue");
        }
        if (!challenge.delivered()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Wait for the code to be sent before verifying");
        }
        if (code != null && code.matches("[0-9]{6}") && challenge.code().equals(code)) {
            challenges.remove(key);
            return;
        }
        int attempts = challenge.attempts() + 1;
        if (attempts >= MAX_ATTEMPTS) {
            challenges.remove(key);
            throw new ResponseStatusException(HttpStatus.GONE, "Too many incorrect attempts. Request a new code");
        }
        challenges.put(key, new Challenge(challenge.code(), challenge.expiresAt(), attempts, true));
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
            "Incorrect code. Attempts remaining: " + (MAX_ATTEMPTS - attempts));
    }

    public long unlock(int caseId, UserEntity actor, String session, String code) {
        verifyCode(new Scope(caseId, null, Action.UNLOCK), actor, code);
        Instant expiresAt = clock.instant().plus(WORKSPACE_ACCESS);
        synchronized (this) {
            grants.values().removeIf(expiry -> !expiry.isAfter(clock.instant()));
            grants.put(new GrantKey(actor.getUserId(), caseId, session), expiresAt);
        }
        return expiresAt.toEpochMilli();
    }

    public long accessExpiresAt(int caseId, UserEntity actor, String session) {
        authorize(caseId, actor);
        synchronized (this) {
            var key = new GrantKey(actor.getUserId(), caseId, session);
            Instant expiresAt = grants.get(key);
            if (expiresAt == null || !expiresAt.isAfter(clock.instant())) {
                grants.remove(key);
                return 0;
            }
            return expiresAt.toEpochMilli();
        }
    }

    public void requireWorkspaceAccess(int caseId, UserEntity actor, String session) {
        if (accessExpiresAt(caseId, actor, session) == 0) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Unlock case documents with an email code first");
        }
    }

    private void authorize(int caseId, UserEntity actor) {
        var legalCase = cases.findById(caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
        int userId = actor.getUserId();
        boolean client = actor.getAccountType() == AccountType.CLIENT
            && legalCase.getClient() != null && legalCase.getClient().getUserId() == userId;
        boolean lawyer = actor.getAccountType() == AccountType.LAWYER
            && legalCase.getLawyer() != null && legalCase.getLawyer().getUserId() == userId;
        if (!client && !lawyer) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only case participants can access documents");
        }
        if (legalCase.getStatus() != CaseStatus.ACCEPTED && legalCase.getStatus() != CaseStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Document access opens once the case is accepted");
        }
    }
}
