package com.wachichaw.Document;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistration;
import com.wachichaw.Config.DocumentPinConfig;
import com.wachichaw.Document.Service.DocumentPinService;
import com.wachichaw.Document.Repo.DocumentRepo;
import com.wachichaw.Document.Entity.DocumentEntity;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.User.Entity.UserEntity;

class DocumentPinAccessTest {
    static class Registry extends InterceptorRegistry {
        HandlerInterceptor interceptor;
        @Override public InterceptorRegistration addInterceptor(HandlerInterceptor interceptor) {
            this.interceptor = interceptor; return super.addInterceptor(interceptor);
        }
    }
    Registry registry;
    DocumentPinService pins;
    @BeforeEach void setup() {
        pins = mock(DocumentPinService.class);
        var documents = mock(DocumentRepo.class);
        var c = new LegalCasesEntity(); c.setCaseId(7);
        var d = new DocumentEntity(); d.setCaseEntity(c);
        when(documents.findById(9)).thenReturn(Optional.of(d));
        registry = new Registry();
        new DocumentPinConfig(pins, documents).addInterceptors(registry);
        var actor = new com.wachichaw.Client.Entity.ClientEntity(); actor.setUserId(1);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null, java.util.List.of()));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void blocksAllDocumentOperationsUntilUnlocked() throws Exception {
        for (String path : java.util.List.of("/case/7", "/case/7/count", "/client/1/case/7", "/upload/1", "/9", "/9/download", "/9/summary", "/9/preview")) {
            var request = new MockHttpServletRequest("POST", "/api/documents" + path);
            request.addHeader("Authorization", "Bearer login"); request.setParameter("caseId", "7");
            var response = new MockHttpServletResponse();
            assertFalse(registry.interceptor.preHandle(request, response, new Object()), path);
            assertEquals(423, response.getStatus(), path);
        }
        verify(pins, times(8)).unlocked(7, 1, "Bearer login");
        when(pins.unlocked(7, 1, "Bearer login")).thenReturn(true);
        var request = new MockHttpServletRequest("GET", "/api/documents/9/download");
        request.addHeader("Authorization", "Bearer login");
        assertTrue(registry.interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }
    @Test void disablesLegacyPublicUploadAndRejectsAnonymousAccess() throws Exception {
        var response = new MockHttpServletResponse();
        assertFalse(registry.interceptor.preHandle(new MockHttpServletRequest("POST", "/api/documents/legacy/upload/1"), response, new Object()));
        assertEquals(410, response.getStatus());
        SecurityContextHolder.clearContext(); response = new MockHttpServletResponse();
        assertFalse(registry.interceptor.preHandle(new MockHttpServletRequest("GET", "/api/documents/case/7/pin"), response, new Object()));
        assertEquals(401, response.getStatus());
    }
}
