package com.wachichaw.Deployment;

import com.wachichaw.EmailConfig.Service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

@ExtendWith(OutputCaptureExtension.class)
class EmailDiagnosticsTest {
    @Test void requestFilterDoesNotLogSensitiveBody(CapturedOutput output) throws Exception {
        var request = new org.springframework.mock.web.MockHttpServletRequest("POST", "/users/Client");
        byte[] body = "password=private-password&token=123456".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        request.setContent(body);
        var response = new org.springframework.mock.web.MockHttpServletResponse();
        new com.wachichaw.Config.RequestLoggingFilter().doFilter(request, response,
            (req, res) -> assertArrayEquals(body, req.getInputStream().readAllBytes()));
        assertFalse(output.getOut().contains("private-password"));
        assertFalse(output.getOut().contains("123456"));
    }
    private EmailService service() {
        var service = new EmailService(1234);
        ReflectionTestUtils.setField(service, "apiToken", "fake-secret-token");
        ReflectionTestUtils.setField(service, "fromEmail", "sender@example.test");
        ReflectionTestUtils.setField(service, "fromName", "Test");
        return service;
    }
    private MockRestServiceServer server(EmailService service) {
        return MockRestServiceServer.createServer((RestTemplate) ReflectionTestUtils.getField(service, "mailClient"));
    }
    private void send(EmailService service) {
        service.sendEmail("private@example.test", "Private subject", "<p>Private Name 123456</p>");
    }
    @Test void missingKeyIsLoggedWithoutNetwork(CapturedOutput output) {
        var service = service(); var server = server(service);
        ReflectionTestUtils.setField(service, "apiToken", " ");
        assertThrows(EmailDeliveryException.class, () -> send(service));
        assertTrue(output.getOut().contains("apiKeyConfigured=false senderConfigured=true"));
        server.verify();
    }
    @Test void missingSenderIsLogged(CapturedOutput output) {
        var service = service(); var server = server(service);
        ReflectionTestUtils.setField(service, "fromEmail", "");
        assertThrows(EmailDeliveryException.class, () -> send(service));
        assertTrue(output.getOut().contains("apiKeyConfigured=true senderConfigured=false"));
        server.verify();
    }
    @Test void acceptedEmailDoesNotLogFailure(CapturedOutput output) {
        var service = service(); var server = server(service);
        server.expect(requestTo("https://api.mailersend.com/v1/email")).andRespond(withStatus(HttpStatus.ACCEPTED));
        assertDoesNotThrow(() -> send(service));
        assertFalse(output.getOut().contains("MAILERSEND_DELIVERY_FAILED"));
        server.verify();
    }
    @Test void authenticationFailureIncludesStatusAndSafeMessage(CapturedOutput output) {
        var service = service(); var server = server(service);
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
            .body("{\"message\":\"Unauthenticated.\"}").contentType(MediaType.APPLICATION_JSON));
        var error = assertThrows(EmailDeliveryException.class, () -> send(service));
        assertNotNull(error.getCause());
        assertTrue(output.getOut().contains("httpStatus=401 providerMessage=Unauthenticated."));
        server.verify();
    }
    @Test void rejectionLogsCodesWithoutEchoedSensitiveData(CapturedOutput output) {
        var service = service(); var server = server(service);
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
            .body("""
                {"message":"The given data was invalid.","errors":{
                  "from.email":["The from.email domain must be verified in your account to send emails. #MS42207"],
                  "to":["private@example.test Private Name 123456 fake-secret-token Authorization: Bearer fake-secret-token"],
                  "html":["<p>Private Name 123456</p>"]}}
                """).contentType(MediaType.APPLICATION_JSON));
        assertThrows(EmailDeliveryException.class, () -> send(service));
        String log = output.getOut();
        assertTrue(log.contains("httpStatus=422"));
        assertTrue(log.contains("#MS42207"));
        for (String secret : new String[]{"private@example.test", "Private Name", "123456", "fake-secret-token", "Authorization", "<p>"}) {
            assertFalse(log.contains(secret), secret);
        }
        server.verify();
    }
    @Test void timeoutIncludesCauseAndConfiguredLimits(CapturedOutput output) {
        var service = service(); var server = server(service);
        server.expect(anything()).andRespond(withException(new java.net.SocketTimeoutException("private@example.test")));
        assertThrows(EmailDeliveryException.class, () -> send(service));
        assertTrue(output.getOut().contains("cause=java.net.SocketTimeoutException"));
        assertTrue(output.getOut().contains("timeout=true"));
        assertTrue(output.getOut().contains("readTimeoutMs=1234 elapsedMs="));
        assertFalse(output.getOut().contains("private@example.test"));
        server.verify();
    }
    @Test void connectionFailureIsDistinguished(CapturedOutput output) {
        var service = service(); var server = server(service);
        server.expect(anything()).andRespond(withException(new java.net.ConnectException("private detail")));
        assertThrows(EmailDeliveryException.class, () -> send(service));
        assertTrue(output.getOut().contains("timeout=false connectionFailure=true"));
        assertFalse(output.getOut().contains("private detail"));
        server.verify();
    }
    @Test void unexpectedSuccessStatusIsLogged(CapturedOutput output) {
        var service = service(); var server = server(service);
        server.expect(anything()).andRespond(withStatus(HttpStatus.OK).body("private body"));
        assertThrows(EmailDeliveryException.class, () -> send(service));
        assertTrue(output.getOut().contains("httpStatus=200"));
        assertFalse(output.getOut().contains("private body"));
        server.verify();
    }
}
