package com.wachichaw.Document.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;

@Service
public class DocumentPinService {
    private final LegalCaseRepo cases;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final Map<String, Instant> grants = new ConcurrentHashMap<>();
    // Attempts are shared across sessions for each case/user.
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();
    private record Attempts(int count, Instant until) {}
    public DocumentPinService(LegalCaseRepo cases) { this.cases = cases; }

    @org.springframework.transaction.annotation.Transactional
    public String initializeExistingCase(int caseId, int userId) {
        var c = cases.findByIdForHearingBooking(caseId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (c.getLawyer() == null || c.getLawyer().getUserId() != userId || c.getStatus() != CaseStatus.ACCEPTED)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned lawyer can set up an accepted case");
        if (c.getDocumentPinHash() != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This case already has a PIN");
        String pin = String.format(java.util.Locale.ROOT, "%04d", new java.security.SecureRandom().nextInt(10000));
        c.setDocumentPinHash(encoder.encode(pin));
        cases.save(c);
        return pin;
    }

    public LegalCasesEntity participant(int caseId, int userId) {
        var c = cases.findById(caseId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if ((c.getClient() == null || c.getClient().getUserId() != userId)
                && (c.getLawyer() == null || c.getLawyer().getUserId() != userId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only case participants can unlock documents");
        return c;
    }
    public boolean unlocked(int caseId, int userId, String session) {
        var c = participant(caseId, userId);
        grants.entrySet().removeIf(e -> e.getValue().isBefore(Instant.now()));
        return c.getDocumentPinHash() != null
            && (c.getStatus() == CaseStatus.ACCEPTED || c.getStatus() == CaseStatus.COMPLETED)
            && grants.containsKey(userId + ":" + caseId + ":" + session);
    }
    public long expiresAt(int caseId, int userId, String session) {
        return grants.getOrDefault(userId + ":" + caseId + ":" + session, Instant.EPOCH).toEpochMilli();
    }
    public void unlock(int caseId, int userId, String session, String pin) {
        verifyPin(caseId, userId, pin);
        grants.put(userId + ":" + caseId + ":" + session, Instant.now().plusSeconds(900));
    }

    // Every file preview checks the PIN again without extending document access.
    public synchronized void verifyPin(int caseId, int userId, String pin) {
        var c = participant(caseId, userId);
        if (c.getStatus() != CaseStatus.ACCEPTED && c.getStatus() != CaseStatus.COMPLETED)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Documents unlock after the lawyer accepts the case");
        String key = userId + ":" + caseId;
        Instant now = Instant.now();
        attempts.entrySet().removeIf(e -> e.getValue().until().isBefore(now));
        var prior = attempts.get(key);
        if (prior != null && prior.until().isAfter(now) && prior.count() >= 5)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Try again in 15 minutes");
        if (pin == null || !pin.matches("[0-9]{4}") || c.getDocumentPinHash() == null || !encoder.matches(pin, c.getDocumentPinHash())) {
            int count = prior != null && prior.until().isAfter(now) ? prior.count() + 1 : 1;
            attempts.put(key, new Attempts(count, prior != null && prior.until().isAfter(now) ? prior.until() : now.plusSeconds(900)));
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Incorrect four-digit PIN");
        }
        attempts.remove(key);
    }
}
