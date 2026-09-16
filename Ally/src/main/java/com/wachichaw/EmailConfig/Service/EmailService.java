package com.wachichaw.EmailConfig.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.List;
import java.util.Map;

@Service
public class EmailService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(EmailService.class);
    private final int readTimeoutMs;

    @Value("${MAILERSEND_API_KEY:}")
    private String apiToken;
    @Value("${mailersend.from-email:}")
    private String fromEmail;
    @Value("${mailersend.from-name:Ally Team}")
    private String fromName;
    private final RestTemplate mailClient;

    public EmailService(@Value("${mailersend.timeout-ms:15000}") int timeout) {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        readTimeoutMs = Math.max(1, timeout);
        factory.setReadTimeout(readTimeoutMs);
        mailClient = new RestTemplate(factory);
    }

    public void sendEmail(String to, String subject, String body) {
        long started = System.nanoTime();
        if (!StringUtils.hasText(to) || !StringUtils.hasText(subject) || !StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Email to, subject, and body must not be empty");
        }
        if (!StringUtils.hasText(apiToken) || !StringUtils.hasText(fromEmail)) {
            logFailure(new EmailDeliveryException("configuration"), null,
                "Missing API key or sender configuration", started);
            throw new EmailDeliveryException("Email delivery is not configured on the server.");
        }
        var headers = new HttpHeaders();
        headers.setBearerAuth(apiToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        var payload = Map.of(
            "from", Map.of("email", fromEmail, "name", fromName),
            "to", List.of(Map.of("email", to)),
            "subject", subject, "html", body);
        try {
            var response = mailClient.postForEntity("https://api.mailersend.com/v1/email",
                new HttpEntity<>(payload, headers), String.class);
            if (response.getStatusCode().value() != 202) {
                logFailure(new EmailDeliveryException("unexpected status"), response.getStatusCode().value(),
                    safeProviderMessage(response.getBody()), started);
                throw new EmailDeliveryException("The email provider did not accept the message.");
            }
        } catch (org.springframework.web.client.RestClientResponseException exception) {
            logFailure(exception, exception.getStatusCode().value(),
                safeProviderMessage(exception.getResponseBodyAsString()), started);
            throw new EmailDeliveryException("Email delivery is temporarily unavailable.", exception);
        } catch (org.springframework.web.client.RestClientException exception) {
            logFailure(exception, null, "No HTTP response", started);
            throw new EmailDeliveryException("Email delivery is temporarily unavailable.", exception);
        }
    }

    private void logFailure(Exception exception, Integer status, String providerMessage, long started) {
        Throwable cause = exception;
        boolean timeout = false;
        boolean connectionFailure = false;
        for (int depth = 0; depth < 16; depth++) {
            timeout |= cause instanceof java.net.SocketTimeoutException;
            connectionFailure |= cause instanceof java.net.ConnectException
                || cause instanceof java.net.UnknownHostException
                || cause instanceof javax.net.ssl.SSLException
                || cause instanceof java.net.NoRouteToHostException;
            if (cause.getCause() == null || cause.getCause() == cause) break;
            cause = cause.getCause();
        }
        // Never pass a Throwable or arbitrary provider text to the logger: both can contain the request.
        log.warn("MAILERSEND_DELIVERY_FAILED exception={} cause={} httpStatus={} providerMessage={} "
                + "apiKeyConfigured={} senderConfigured={} timeout={} connectionFailure={} "
                + "connectTimeoutMs=5000 readTimeoutMs={} elapsedMs={}",
            exception.getClass().getName(), cause.getClass().getName(), status, providerMessage,
            StringUtils.hasText(apiToken), StringUtils.hasText(fromEmail), timeout, connectionFailure,
            readTimeoutMs, (System.nanoTime() - started) / 1_000_000);
    }

    private String safeProviderMessage(String body) {
        if (body == null || body.isBlank()) return "Empty provider response";
        // Only fixed, non-personal messages are allowed. Unknown messages are withheld rather than
        // relying on regex redaction of names, credentials, OTPs, or echoed email content.
        try {
            var root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);
            var messages = new java.util.LinkedHashSet<String>();
            collectSafeMessages(root.path("message"), messages);
            collectSafeMessages(root.path("errors"), messages);
            return messages.isEmpty() ? "Provider response withheld (unrecognized message)" : String.join("; ", messages);
        } catch (java.io.IOException exception) {
            return "Provider response withheld (non-JSON response)";
        }
    }

    private void collectSafeMessages(com.fasterxml.jackson.databind.JsonNode node, java.util.Set<String> messages) {
        if (node.isTextual()) {
            String message = node.asText();
            if (java.util.Set.of("Unauthenticated.", "Unauthorized", "Forbidden", "Too Many Attempts.",
                    "The given data was invalid.",
                    "The from.email domain must be verified in your account to send emails. #MS42207")
                    .contains(message)) {
                messages.add(message);
            }
            var codes = java.util.regex.Pattern.compile("#MS[0-9]{5}\\b").matcher(message);
            while (codes.find() && messages.size() < 16) messages.add(codes.group());
        } else if (node.isContainerNode()) {
            node.forEach(child -> collectSafeMessages(child, messages));
        }
    }

    public void sendAppointmentReminder(String to, String userName, java.time.LocalDateTime appointmentTime, String userType) {
        String subject = "Appointment Reminder";
        String body = "<html>" +
                "<body>" +
                "<h3>Hi " + userName + ",</h3>" +
                "<p>This is a reminder for your upcoming appointment on " + appointmentTime.toLocalDate() + " at " + appointmentTime.toLocalTime() + ".</p>" +
                "<p>Thank you,</p>" +
                "<p>Ally Team</p>" +
                "</body>" +
                "</html>";
        sendEmail(to, subject, body);
    }

    public void sendPasswordResetEmail(String to, String resetLink) {
        String subject = "Reset your ALLY password";
        String body = "<html><body>"
                + "<h3>Password reset request</h3>"
                + "<p>Click the link below to set a new password. This link expires in 15 minutes and can only be used once.</p>"
                + "<p><a href=\"" + resetLink + "\">Reset password</a></p>"
                + "<p>If you did not request a password reset, you can safely ignore this email.</p>"
                + "</body></html>";
        sendEmail(to, subject, body);
    }

}
