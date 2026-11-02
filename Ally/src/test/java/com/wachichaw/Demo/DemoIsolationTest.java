package com.wachichaw.Demo;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.wachichaw.AllyChatAI.Controller.ChatController;
import com.wachichaw.AllyChatAI.Service.AiChatHistoryService;
import com.wachichaw.AllyChatAI.Service.DeepSeekChatService;
import com.wachichaw.AllyRAG.LegalQuestionValidator;
import com.wachichaw.AllyRAG.RagService;
import com.wachichaw.Audit.Service.AuditLogService;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.Document.Service.DocumentService;
import com.wachichaw.Document.Service.DocumentSummaryService;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.Lawyer.Repo.LawyerRepo;

class DemoIsolationTest {
    private LawyerRepo lawyers;
    private DeepSeekChatService ai;
    private DocumentService documents;
    private AiChatHistoryService history;
    private AuditLogService audit;
    private JwtUtil jwt;
    private DemoController demo;
    private MockMvc mvc;

    @BeforeEach void setup() {
        lawyers = mock(LawyerRepo.class);
        ai = mock(DeepSeekChatService.class);
        documents = mock(DocumentService.class);
        history = mock(AiChatHistoryService.class);
        audit = mock(AuditLogService.class);
        jwt = mock(JwtUtil.class);
        var chat = new ChatController();
        ReflectionTestUtils.setField(chat, "deepSeekChatService", ai);
        ReflectionTestUtils.setField(chat, "ragService", mock(RagService.class));
        ReflectionTestUtils.setField(chat, "validator", new LegalQuestionValidator());
        ReflectionTestUtils.setField(chat, "aiChatHistoryService", history);
        ReflectionTestUtils.setField(chat, "auditLogService", audit);
        ReflectionTestUtils.setField(chat, "jwtUtil", jwt);
        var summaries = new DocumentSummaryService(documents, ai);
        ReflectionTestUtils.setField(summaries, "maxCharacters", 60000);
        demo = new DemoController(lawyers, chat, summaries);
        ReflectionTestUtils.setField(demo, "enabled", true);
        mvc = MockMvcBuilders.standaloneSetup(demo).build();
    }

    @Test void demoChatIgnoresRealAccountAuthorizationAndDoesNotPersist() throws Exception {
        when(ai.sendMessage(anyString(), anyList())).thenReturn("QUICK_SUMMARY: Gather your records.\n\nBring the agreement.");
        mvc.perform(post("/api/demo/chat").header("Authorization", "Bearer real-user-token")
            .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"What records should I bring for a civil loan dispute?\",\"useRAG\":false}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.response").value(org.hamcrest.Matchers.containsString("Gather your records")));
        verifyNoInteractions(jwt, history, audit, documents, lawyers);
    }

    @Test void directoryExposesOnlyReadOnlyProfileFields() throws Exception {
        var lawyer = new LawyerEntity();
        lawyer.setUserId(18); lawyer.setFname("Sample"); lawyer.setLname("Lawyer");
        lawyer.setCity("Cebu City"); lawyer.setSpecialization(List.of("Civil Law"));
        lawyer.setPassword("private-password"); lawyer.setEmail("private@example.test");
        when(lawyers.findByCredentialsVerified(true)).thenReturn(List.of(lawyer));
        mvc.perform(get("/api/demo/lawyers")).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Atty. Sample Lawyer"))
            .andExpect(jsonPath("$[0].id").value("demo-lawyer-18"))
            .andExpect(jsonPath("$[0].password").doesNotExist())
            .andExpect(jsonPath("$[0].email").doesNotExist())
            .andExpect(jsonPath("$[0].cases").doesNotExist())
            .andExpect(jsonPath("$[0].credentials").doesNotExist());
        verify(lawyers).findByCredentialsVerified(true);
        verifyNoMoreInteractions(lawyers);
    }

    @Test void suppliedPdfUsesCurrentSummaryPipelineWithoutStorageOrCaseWrites() throws Exception {
        byte[] bytes = Files.readAllBytes(Path.of("../ally-frontend/public/demo/GR-233460.pdf"));
        when(ai.summarizeDocument(anyString(), anyString(), anyBoolean())).thenReturn("## Overview\nSample AI output");
        var file = new MockMultipartFile("file", "G.R. No. 233460.pdf", "application/pdf", bytes);
        mvc.perform(multipart("/api/demo/summary").file(file).header("Authorization", "Bearer real-user-token"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.documentId").value(0))
            .andExpect(jsonPath("$.documentName").value("G.R. No. 233460.pdf"))
            .andExpect(jsonPath("$.summary").value(org.hamcrest.Matchers.containsString("Sample AI output")));
        var extracted = ArgumentCaptor.forClass(String.class);
        verify(ai).summarizeDocument(eq("G.R. No. 233460.pdf"), extracted.capture(), eq(false));
        assertTrue(extracted.getValue().contains("233460"));
        assertTrue(extracted.getValue().contains("FERNANDEZ"));
        assertTrue(extracted.getValue().length() > 10000);
        verifyNoInteractions(documents, history, audit, jwt, lawyers);
    }

    @Test void rejectsRenamedNonPdfAndOversizedUploadsBeforeAi() throws Exception {
        mvc.perform(multipart("/api/demo/summary").file(new MockMultipartFile("file", "fake.pdf", "application/pdf", "not a PDF".getBytes())))
            .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/demo/summary").file(new MockMultipartFile("file", "too-big.pdf", "application/pdf", new byte[10 * 1024 * 1024 + 1])))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(ai, documents);
    }

    @Test void serviceFailureIsRetryableAndNeverReturnsASimulatedSummary() throws Exception {
        when(ai.summarizeDocument(anyString(), anyString(), anyBoolean())).thenThrow(new IllegalStateException("No AI service"));
        byte[] bytes = Files.readAllBytes(Path.of("../ally-frontend/public/demo/GR-233460.pdf"));
        mvc.perform(multipart("/api/demo/summary").file(new MockMultipartFile("file", "sample.pdf", "application/pdf", bytes)))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.summary").doesNotExist());
        verifyNoInteractions(documents);
    }

    @Test void demoCanBeDisabledWithoutTouchingRealApplicationData() throws Exception {
        ReflectionTestUtils.setField(demo, "enabled", false);
        mvc.perform(get("/api/demo/lawyers")).andExpect(status().isNotFound());
        mvc.perform(post("/api/demo/chat").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"hello\"}"))
            .andExpect(status().isNotFound());
        mvc.perform(multipart("/api/demo/summary").file(new MockMultipartFile("file", "sample.pdf", "application/pdf", "%PDF-".getBytes())))
            .andExpect(status().isNotFound());
        verifyNoInteractions(ai, lawyers, documents, history, audit, jwt);
    }
}
