package com.wachichaw.Case;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.wachichaw.Case.Controller.CaseNoteController;
import com.wachichaw.Case.Entity.CaseNoteEntity;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.CaseNoteRepo;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Case.Service.CaseNoteService;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CaseNoteAccessTest {
    private static final String URL = "/api/cases/10/note";
    private final LegalCaseRepo cases = mock(LegalCaseRepo.class);
    private final CaseNoteRepo notes = mock(CaseNoteRepo.class);
    private final ClientEntity client = new ClientEntity();
    private final LawyerEntity lawyer = new LawyerEntity();
    private MockMvc mvc;

    @BeforeEach void setUp() {
        client.setUserId(1);
        client.setAccountType(AccountType.CLIENT);
        lawyer.setUserId(2);
        lawyer.setAccountType(AccountType.LAWYER);
        for (int id : List.of(10, 11)) {
            var legalCase = new LegalCasesEntity();
            legalCase.setCaseId(id);
            legalCase.setClient(client);
            legalCase.setLawyer(lawyer);
            when(cases.findById(id)).thenReturn(Optional.of(legalCase));
            when(cases.findByIdForUpdate(id)).thenReturn(Optional.of(legalCase));
        }

        Map<List<Integer>, CaseNoteEntity> stored = new HashMap<>();
        when(notes.findByLegalCaseCaseIdAndAuthorUserId(anyInt(), anyInt())).thenAnswer(call ->
            Optional.ofNullable(stored.get(List.of(call.<Integer>getArgument(0), call.<Integer>getArgument(1)))));
        when(notes.save(any())).thenAnswer(call -> {
            CaseNoteEntity note = call.getArgument(0);
            stored.put(List.of(note.getLegalCase().getCaseId(), note.getAuthor().getUserId()), note);
            return note;
        });

        mvc = MockMvcBuilders.standaloneSetup(new CaseNoteController(new CaseNoteService(cases, notes)))
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
    }

    @AfterEach void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test void noteIsPrivateToItsAuthorAndCaseAndCanBeCleared() throws Exception {
        signIn(client);
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Client draft\\nBring records\",\"authorId\":2}"))
            .andExpect(status().isOk());
        mvc.perform(get(URL)).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.content").value("Client draft\nBring records"));
        mvc.perform(get("/api/cases/11/note")).andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());

        signIn(lawyer);
        mvc.perform(get(URL)).andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Lawyer draft\"}"))
            .andExpect(status().isOk());

        signIn(client);
        mvc.perform(get(URL)).andExpect(jsonPath("$.content").value("Client draft\nBring records"));
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"\"}"))
            .andExpect(status().isOk());
        mvc.perform(get(URL)).andExpect(jsonPath("$.content").value(""));
    }

    @Test void unauthenticatedUsersAndOutsidersCannotReadOrSaveNotes() throws Exception {
        var request = put(URL).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Other note\"}");
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(request).andExpect(status().isUnauthorized());

        var outsider = new ClientEntity();
        outsider.setUserId(3);
        outsider.setAccountType(AccountType.CLIENT);
        signIn(outsider);
        mvc.perform(get(URL)).andExpect(status().isForbidden());
        mvc.perform(request).andExpect(status().isForbidden());
        verifyNoInteractions(notes);
    }

    private void signIn(UserEntity user) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }
}
