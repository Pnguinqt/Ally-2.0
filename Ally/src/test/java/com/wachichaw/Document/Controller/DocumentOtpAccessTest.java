package com.wachichaw.Document.Controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Config.DocumentAccessConfig;
import com.wachichaw.Document.Entity.DocumentEntity;
import com.wachichaw.Document.Repo.DocumentRepo;
import com.wachichaw.Document.Service.DocumentOtpService;
import com.wachichaw.Document.Service.DocumentService;
import com.wachichaw.EmailConfig.Service.EmailDeliveryException;
import com.wachichaw.EmailConfig.Service.EmailService;
import com.wachichaw.User.Entity.AccountType;

class DocumentOtpAccessTest {
    private static final String API = "/api/documents";
    private static final String SESSION = "Bearer login";
    private final EmailService email = mock(EmailService.class);
    private final DocumentService documents = mock(DocumentService.class);
    private final DocumentEntity document = new DocumentEntity();
    private final ClientEntity client = new ClientEntity();
    private MockMvc mvc;
    private String deliveredCode;

    static class Registry extends InterceptorRegistry {
        HandlerInterceptor interceptor;

        @Override
        public InterceptorRegistration addInterceptor(HandlerInterceptor interceptor) {
            this.interceptor = interceptor;
            return super.addInterceptor(interceptor);
        }
    }

    @BeforeEach void setup() throws Exception {
        client.setUserId(1);
        client.setAccountType(AccountType.CLIENT);
        client.setEmail("client@example.test");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(client, null, List.of()));
        var legalCase = new LegalCasesEntity();
        legalCase.setCaseId(7);
        legalCase.setStatus(CaseStatus.ACCEPTED);
        legalCase.setClient(client);
        document.setCaseEntity(legalCase);
        document.setDocumentType("PDF");
        document.setDocumentName("case file.pdf");
        var caseRepo = mock(LegalCaseRepo.class);
        var documentRepo = mock(DocumentRepo.class);
        when(caseRepo.findById(7)).thenReturn(Optional.of(legalCase));
        when(documentRepo.findById(9)).thenReturn(Optional.of(document));
        when(documents.retrieveDocument(9, 1, "CLIENT")).thenReturn(document);
        when(documents.readDocumentBytes(document)).thenReturn(new byte[]{1, 2});
        doAnswer(invocation -> {
            var matcher = Pattern.compile("<strong>([0-9]{6})</strong>").matcher(invocation.getArgument(2));
            assertTrue(matcher.find());
            deliveredCode = matcher.group(1);
            return null;
        }).when(email).sendEmail(anyString(), anyString(), anyString());
        var otp = new DocumentOtpService(caseRepo, email);
        var registry = new Registry();
        new DocumentAccessConfig(otp, documentRepo).addInterceptors(registry);
        mvc = MockMvcBuilders.standaloneSetup(new DocumentOtpController(otp),
                new DocumentPreviewController(documents, otp), new DocumentController(documents))
            .setControllerAdvice(new DocumentOtpErrors())
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
            .addInterceptors(registry.interceptor)
            .build();
    }

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test void documentRoutesRequireAnAuthenticatedSessionAndWorkspaceAccess() throws Exception {
        mvc.perform(post(API + "/case/7/otp/request")).andExpect(status().isUnauthorized());
        mvc.perform(get(API + "/case/7").header(HttpHeaders.AUTHORIZATION, SESSION)).andExpect(status().isLocked());
        mvc.perform(post(API + "/9/preview/otp").header(HttpHeaders.AUTHORIZATION, SESSION)).andExpect(status().isLocked());
        mvc.perform(post(API + "/legacy/upload/1").header(HttpHeaders.AUTHORIZATION, SESSION)).andExpect(status().isGone());
        verifyNoInteractions(email);
        verify(documents, never()).readDocumentBytes(any());
    }

    @Test void generationUsesOnlyTheRegisteredAddressAndResponseNeverIncludesTheCode() throws Exception {
        mvc.perform(post(API + "/case/7/otp/request").header(HttpHeaders.AUTHORIZATION, SESSION)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"attacker@example.test\"}"))
            .andExpect(status().isAccepted()).andExpect(jsonPath("$.expiresAt").isNumber())
            .andExpect(jsonPath("$.otp").doesNotExist()).andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
        verify(email).sendEmail(eq(client.getEmail()), anyString(), anyString());
    }

    @Test void missingEmailConfigurationReturnsAnActionable503() throws Exception {
        doThrow(new EmailDeliveryException.NotConfigured()).when(email).sendEmail(anyString(), anyString(), anyString());
        mvc.perform(post(API + "/case/7/otp/request").header(HttpHeaders.AUTHORIZATION, SESSION))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.message").value("Document email delivery is not configured. Contact support for help."));
    }

    @Test void previewAndDownloadConsumeSeparateCodesBeforeReturningBytes() throws Exception {
        unlockWorkspace();
        request("/9/preview/otp");
        String previewCode = deliveredCode;
        request("/9/download/otp");
        String downloadCode = deliveredCode;

        verifyCode("/9/download", previewCode).andExpect(status().isForbidden());
        verify(documents, never()).readDocumentBytes(any());

        verifyCode("/9/preview", previewCode).andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(content().contentType(MediaType.APPLICATION_PDF)).andExpect(content().bytes(new byte[]{1, 2}));
        verifyCode("/9/preview", previewCode).andExpect(status().isGone());
        verifyCode("/9/download", downloadCode).andExpect(status().isOk())
            .andExpect(header().exists(HttpHeaders.CONTENT_DISPOSITION))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store")).andExpect(content().bytes(new byte[]{1, 2}));
        verifyCode("/9/download", downloadCode).andExpect(status().isGone());
        verify(documents, times(2)).readDocumentBytes(document);

        mvc.perform(get(API + "/9/download").header(HttpHeaders.AUTHORIZATION, SESSION))
            .andExpect(status().isMethodNotAllowed());
    }

    @Test void localPreviewConsumesItsOwnCode() throws Exception {
        unlockWorkspace();
        request("/case/7/otp/local-preview/request");
        String localCode = deliveredCode;
        verifyCode("/case/7/otp/local-preview/verify", localCode).andExpect(status().isNoContent());
        verifyCode("/case/7/otp/local-preview/verify", localCode).andExpect(status().isGone());
        verify(documents, never()).readDocumentBytes(any());
    }

    private void unlockWorkspace() throws Exception {
        request("/case/7/otp/request");
        verifyCode("/case/7/otp/verify", deliveredCode).andExpect(status().isOk());
    }

    private void request(String path) throws Exception {
        mvc.perform(post(API + path).header(HttpHeaders.AUTHORIZATION, SESSION)).andExpect(status().isAccepted());
    }

    private ResultActions verifyCode(String path, String code) throws Exception {
        return mvc.perform(post(API + path).header(HttpHeaders.AUTHORIZATION, SESSION)
            .contentType(MediaType.APPLICATION_JSON).content("{\"otp\":\"" + code + "\"}"));
    }
}
