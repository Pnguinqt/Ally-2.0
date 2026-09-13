package com.wachichaw.EmailConfig.Service;

public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message) { super(message); }
    public EmailDeliveryException(String message, Throwable cause) { super(message, cause); }
}
