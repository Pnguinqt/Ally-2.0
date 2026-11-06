package com.wachichaw.Case;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wachichaw.AllyChatAI.Service.DeepSeekChatService;
import com.wachichaw.Case.Controller.CaseDraftController;
import com.wachichaw.Case.Service.CaseDraftService;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Repo.UserRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.List;
import java.util.Optional;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CaseDraftTest {
    private final DeepSeekChatService ai = mock(DeepSeekChatService.class);
    private final UserRepo users = mock(UserRepo.class);
    private final JwtUtil jwt = new JwtUtil();
    private final ClientEntity client = new ClientEntity();
    private CaseDraftController controller;
    private MockMvc mvc;
    private static final String INPUT = "{\"facts\":\"I lent money to a friend who has not repaid it.\",\"caseType\":\"CIVIL\"}";
    private static final String OUTPUT = "{\"title\":\"Unpaid personal loan\",\"description\":\"I lent money to a friend and have not received repayment.\"}";

    @BeforeEach void setup() {
        client.setUserId(2); client.setAccountType(AccountType.CLIENT);
        when(users.findById(2)).thenReturn(Optional.of(client));
        when(ai.draftCase(anyString(), anyString())).thenReturn(OUTPUT);
        controller = new CaseDraftController(new CaseDraftService(ai), jwt, users);
        ReflectionTestUtils.setField(controller, "demoEnabled", true);
        mvc = MockMvcBuilders.standaloneSetup(controller)
            .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper())).build();
    }

    private String token() { return "Bearer " + jwt.generateToken(client); }

    @Test void signedInClientGetsStructuredSuggestionsWithoutCreatingACase() throws Exception {
        mvc.perform(post("/api/cases/draft-assist").header("Authorization", token()).contentType(MediaType.APPLICATION_JSON).content(INPUT))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Unpaid personal loan"))
            .andExpect(jsonPath("$.description").value("I lent money to a friend and have not received repayment."));
        verify(ai).draftCase(contains("I lent money"), eq("English"));
    }

    @Test void invalidAndMissingTokensCannotUseProductionDrafting() throws Exception {
        mvc.perform(post("/api/cases/draft-assist").contentType(MediaType.APPLICATION_JSON).content(INPUT)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/cases/draft-assist").header("Authorization", "Bearer invalid").contentType(MediaType.APPLICATION_JSON).content(INPUT))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(ai);
    }

    @Test void nonClientsCannotUseProductionDrafting() throws Exception {
        client.setAccountType(AccountType.ADMIN);
        mvc.perform(post("/api/cases/draft-assist").header("Authorization", token()).contentType(MediaType.APPLICATION_JSON).content(INPUT))
            .andExpect(status().isForbidden());
        verifyNoInteractions(ai);
    }

    @Test void demoDoesNotReadProductionIdentityAndCanBeDisabled() throws Exception {
        mvc.perform(post("/api/demo/case-draft").header("Authorization", "Bearer ignored").contentType(MediaType.APPLICATION_JSON).content(INPUT))
            .andExpect(status().isOk());
        verifyNoInteractions(users);
        ReflectionTestUtils.setField(controller, "demoEnabled", false);
        mvc.perform(post("/api/demo/case-draft").contentType(MediaType.APPLICATION_JSON).content(INPUT)).andExpect(status().isNotFound());
    }

    @Test void insufficientOrOversizedFactsNeverCallAI() throws Exception {
        for (String input : List.of("{}", "{\"facts\":\"Help\"}", "{\"facts\":\"" + "a".repeat(3001) + "\"}")) {
            mvc.perform(post("/api/demo/case-draft").contentType(MediaType.APPLICATION_JSON).content(input)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(ai);
    }

    @Test void malformedIncompleteAndOversizedResponsesNeverBecomeSuggestions() throws Exception {
        for (String output : List.of("not json", "{}", "null", "{\"title\":7,\"description\":\"Text\"}",
                OUTPUT.replace("Unpaid personal loan", "a".repeat(161)), OUTPUT.replace("I lent money to a friend and have not received repayment.", "a".repeat(1001)))) {
            when(ai.draftCase(anyString(), anyString())).thenReturn(output);
            mvc.perform(post("/api/demo/case-draft").contentType(MediaType.APPLICATION_JSON).content(INPUT))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.message").isNotEmpty());
        }
    }

    @Test void unavailableAILeavesActionableError() throws Exception {
        when(ai.draftCase(anyString(), anyString())).thenThrow(new IllegalStateException("secret upstream detail"));
        mvc.perform(post("/api/demo/case-draft").contentType(MediaType.APPLICATION_JSON).content(INPUT))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.message").value("ALLY could not prepare a draft. Try again or continue writing your case details."));
    }

    @Test void cebuanoDraftsReceiveTheSelectedLanguageAndExistingFormContext() throws Exception {
        mvc.perform(post("/api/demo/case-draft").contentType(MediaType.APPLICATION_JSON)
            .content(INPUT.replace("\"facts\":", "\"language\":\"ceb\",\"title\":\"Loan issue\",\"facts\":"))).andExpect(status().isOk());
        verify(ai).draftCase(contains("Loan issue"), eq("Cebuano (Bisaya)"));
    }
}
