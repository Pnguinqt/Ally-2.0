package com.wachichaw.Document;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wachichaw.Case.Entity.*;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Case.Service.LegalCaseService;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.User.Entity.AccountType;

class DocumentPinAcceptanceTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void acceptanceGeneratesPinOnceAndDoesNotExposeHash() throws Exception {
        var repo = mock(LegalCaseRepo.class);
        var c = new LegalCasesEntity();
        var lawyer = new LawyerEntity(); lawyer.setUserId(2); lawyer.setAccountType(AccountType.LAWYER);
        c.setLawyer(lawyer); c.setStatus(CaseStatus.PENDING);
        when(repo.findByIdForHearingBooking(7)).thenReturn(Optional.of(c));
        when(repo.save(c)).thenReturn(c);
        var service = new LegalCaseService(repo);
        assertThrows(RuntimeException.class, () -> service.acceptCase(7, 2));
        assertNull(c.getDocumentPinHash());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(lawyer, null, java.util.List.of()));
        var accepted = service.acceptCase(7, 2);
        String pin = accepted.getGeneratedDocumentPin();
        assertTrue(pin.matches("[0-9]{4}"));
        assertTrue(new BCryptPasswordEncoder().matches(pin, accepted.getDocumentPinHash()));
        assertEquals(CaseStatus.ACCEPTED, accepted.getStatus());
        var json = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(accepted));
        assertFalse(json.has("documentPinHash"));
        assertEquals(pin, json.get("generatedDocumentPin").asText());
        assertThrows(RuntimeException.class, () -> service.acceptCase(7, 2));
        var reloaded = new LegalCasesEntity();
        reloaded.setDocumentPinHash(c.getDocumentPinHash());
        var reloadedJson = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(reloaded));
        assertFalse(reloadedJson.has("documentPinHash"));
        assertFalse(reloadedJson.has("generatedDocumentPin"));
    }
}
