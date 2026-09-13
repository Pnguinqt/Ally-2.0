package com.wachichaw.Deployment;

import com.wachichaw.AllyRAG.RagService;
import com.wachichaw.EmailConfig.Service.*;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ExternalServiceTest {
    private EmailService email() {
        var service = new EmailService(1000);
        ReflectionTestUtils.setField(service, "apiToken", "test-only");
        ReflectionTestUtils.setField(service, "fromEmail", "sender@example.com");
        ReflectionTestUtils.setField(service, "fromName", "ALLY");
        return service;
    }
    private MockRestServiceServer mailServer(EmailService service) {
        return MockRestServiceServer.createServer((RestTemplate) ReflectionTestUtils.getField(service, "mailClient"));
    }
    @Test void missingEmailConfigurationFailsWithoutCallingProvider() {
        var service = new EmailService(1000);
        assertThrows(EmailDeliveryException.class, () -> service.sendEmail("test@example.com", "Subject", "Body"));
    }
    @Test void providerAcceptsEmail() {
        var service = email(); var server = mailServer(service);
        server.expect(requestTo("https://api.mailersend.com/v1/email"))
            .andExpect(jsonPath("$.from.email").value("sender@example.com"))
            .andRespond(withStatus(HttpStatus.ACCEPTED));
        assertDoesNotThrow(() -> service.sendEmail("test@example.com", "Subject", "Body"));
        server.verify();
    }
    @Test void providerRejectionIsControlled() {
        var service = email(); var server = mailServer(service);
        server.expect(requestTo("https://api.mailersend.com/v1/email")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        assertThrows(EmailDeliveryException.class, () -> service.sendEmail("test@example.com", "Subject", "Body"));
        server.verify();
    }
    @Test void emailTimeoutIsControlled() {
        var service = email(); var server = mailServer(service);
        server.expect(requestTo("https://api.mailersend.com/v1/email"))
            .andRespond(withException(new java.net.SocketTimeoutException("timed out")));
        assertThrows(EmailDeliveryException.class, () -> service.sendEmail("test@example.com", "Subject", "Body"));
        server.verify();
    }
    @Test void disabledRagDoesNotMakeNetworkRequests() {
        var rag = new RagService(1000, 1000);
        assertFalse(rag.isRagServiceHealthy());
        assertNotNull(rag.validateQuestion("Question"));
        assertNotNull(rag.searchRelevantCases("Question", 3));
    }
    @Test void unreachableRagIsUnavailable() {
        var rag = new RagService(1000, 1000);
        ReflectionTestUtils.setField(rag, "enabled", true);
        ReflectionTestUtils.setField(rag, "ragServiceUrl", "http://example.test");
        var server = MockRestServiceServer.createServer((RestTemplate) ReflectionTestUtils.getField(rag, "healthRestTemplate"));
        server.expect(requestTo("http://example.test/health")).andRespond(withException(new IOException("offline")));
        assertFalse(rag.isRagServiceHealthy());
        server.verify();
    }
}
