package com.wachichaw.Document;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Case.Service.LegalCaseService;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.User.Entity.AccountType;

class DocumentOtpAcceptanceTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test void acceptanceRequiresTheAssignedLawyerAndReturnsNoSharedPin() throws Exception {
        var repo = mock(LegalCaseRepo.class);
        var legalCase = new LegalCasesEntity();
        var lawyer = new LawyerEntity();
        lawyer.setUserId(2);
        lawyer.setAccountType(AccountType.LAWYER);
        legalCase.setLawyer(lawyer);
        legalCase.setStatus(CaseStatus.PENDING);
        when(repo.findByIdForUpdate(7)).thenReturn(Optional.of(legalCase));
        when(repo.save(legalCase)).thenReturn(legalCase);
        var service = new LegalCaseService(repo);
        assertThrows(RuntimeException.class, () -> service.acceptCase(7, 2));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(lawyer, null, List.of()));
        var accepted = service.acceptCase(7, 2);
        assertEquals(CaseStatus.ACCEPTED, accepted.getStatus());
        var json = new ObjectMapper().valueToTree(accepted);
        assertFalse(json.has("documentPinHash"));
        assertFalse(json.has("generatedDocumentPin"));
        assertThrows(RuntimeException.class, () -> service.acceptCase(7, 2));
    }
}
