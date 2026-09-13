package com.wachichaw.AllyRAG;

import lombok.Data;

@Data
public class ChatRequest {
    private String conversationId;
    private String requestId;
    private java.util.List<PreviousMessage> previousMessages;
    public record PreviousMessage(String role, String content) {}
    private String message;
    private boolean useRAG = false;  // Default to false

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public boolean isUseRAG() {
        return useRAG;
    }

    public void setUseRAG(boolean useRAG) {
        this.useRAG = useRAG;
    }
}
