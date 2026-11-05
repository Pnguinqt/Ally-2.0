package com.wachichaw.Document;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import com.wachichaw.Case.Entity.*;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.Document.Service.DocumentPinService;

class DocumentPinServiceTest {
    LegalCaseRepo repo;
    DocumentPinService pins;
    LegalCasesEntity c;
    @BeforeEach void setup() {
        repo = mock(LegalCaseRepo.class);
        pins = new DocumentPinService(repo);
        c = new LegalCasesEntity();
        var client = new ClientEntity(); client.setUserId(1); c.setClient(client);
        var lawyer = new LawyerEntity(); lawyer.setUserId(2); c.setLawyer(lawyer);
        c.setStatus(CaseStatus.ACCEPTED);
        c.setDocumentPinHash(new BCryptPasswordEncoder().encode("0042"));
        when(repo.findById(7)).thenReturn(Optional.of(c));
        when(repo.findByIdForHearingBooking(7)).thenReturn(Optional.of(c));
    }
    @Test void grantsAreBoundToUserAndLoginAndLeadingZeroPinWorks() {
        assertFalse(pins.unlocked(7, 1, "login-a"));
        pins.unlock(7, 1, "login-a", "0042");
        assertTrue(pins.unlocked(7, 1, "login-a"));
        assertFalse(pins.unlocked(7, 2, "login-a"));
        assertFalse(pins.unlocked(7, 1, "login-b"));
    }
    @Test void blocksGuessingAcrossLogins() {
        for (int i = 0; i < 5; i++) assertThrows(ResponseStatusException.class, () -> pins.unlock(7, 1, "a", "1111"));
        var error = assertThrows(ResponseStatusException.class, () -> pins.unlock(7, 1, "b", "0042"));
        assertEquals(429, error.getStatusCode().value());
    }
    @Test void previewVerificationNeverCreatesOrExtendsDocumentUnlocks() {
        pins.verifyPin(7, 1, "0042");
        assertFalse(pins.unlocked(7, 1, "login"));
        pins.unlock(7, 1, "login", "0042");
        long expiry = pins.expiresAt(7, 1, "login");
        pins.verifyPin(7, 1, "0042");
        assertEquals(expiry, pins.expiresAt(7, 1, "login"));
        assertThrows(ResponseStatusException.class, () -> pins.verifyPin(7, 1, "1111"));
    }
    @Test void rejectsOutsidersAndPendingCases() {
        assertThrows(ResponseStatusException.class, () -> pins.unlock(7, 3, "a", "0042"));
        c.setStatus(CaseStatus.PENDING);
        assertThrows(ResponseStatusException.class, () -> pins.unlock(7, 1, "a", "0042"));
    }
    @Test void setupOnlyOnceAndOnlyByAssignedLawyerAfterAcceptance() {
        c.setDocumentPinHash(null);
        assertThrows(ResponseStatusException.class, () -> pins.initializeExistingCase(7, 1));
        c.setStatus(CaseStatus.PENDING);
        assertThrows(ResponseStatusException.class, () -> pins.initializeExistingCase(7, 2));
        c.setStatus(CaseStatus.ACCEPTED);
        String pin = pins.initializeExistingCase(7, 2);
        assertTrue(pin.matches("[0-9]{4}"));
        assertTrue(new BCryptPasswordEncoder().matches(pin, c.getDocumentPinHash()));
        assertThrows(ResponseStatusException.class, () -> pins.initializeExistingCase(7, 2));
    }
}
