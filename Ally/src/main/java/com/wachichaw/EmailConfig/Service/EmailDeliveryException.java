package com.wachichaw.EmailConfig.Service;

public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message) { super(message); }
    public EmailDeliveryException(String message, Throwable cause) { super(message, cause); }

    public static final class NotConfigured extends EmailDeliveryException {
        public NotConfigured() {
            super("Email delivery is not configured on the server.");
        }
    }
}
