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
        factory.setReadTimeout(Math.max(1, timeout));
        mailClient = new RestTemplate(factory);
    }

    public void sendEmail(String to, String subject, String body) {
        if (!StringUtils.hasText(to) || !StringUtils.hasText(subject) || !StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Email to, subject, and body must not be empty");
        }
        if (!StringUtils.hasText(apiToken) || !StringUtils.hasText(fromEmail)) {
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
                throw new EmailDeliveryException("The email provider did not accept the message.");
            }
        } catch (org.springframework.web.client.RestClientException exception) {
            // Do not log provider payloads, recipient details, API tokens, or OTPs.
            org.slf4j.LoggerFactory.getLogger(EmailService.class).warn(
                "Email delivery failed ({})", exception.getClass().getSimpleName());
            throw new EmailDeliveryException("Email delivery is temporarily unavailable.", exception);
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
