package com.wachichaw.AllyChatAI.Service;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.wachichaw.AllyChatAI.Entity.AiChatHistoryEntity;
import com.wachichaw.AllyChatAI.Repo.AiChatHistoryRepo;

@Service
public class AiChatHistoryService {

    private final AiChatHistoryRepo aiChatHistoryRepo;

    public AiChatHistoryService(AiChatHistoryRepo aiChatHistoryRepo) {
        this.aiChatHistoryRepo = aiChatHistoryRepo;
    }

    public AiChatHistoryEntity save(int userId, String userMessage, String aiResponse,
                                    boolean ragEnabled, Integer caseCount, String confidence,
                                    String conversationId, String requestId, String responseMetadata) {
        AiChatHistoryEntity history = new AiChatHistoryEntity();
        history.setUserId(userId);
        history.setConversationId(conversationId);
        history.setRequestId(requestId);
        history.setResponseMetadata(responseMetadata);
        history.setUserMessage(userMessage);
        history.setAiResponse(aiResponse);
        history.setRagEnabled(ragEnabled);
        history.setCaseCount(caseCount);
        history.setConfidence(confidence);
        return aiChatHistoryRepo.save(history);
    }

    public List<AiChatHistoryEntity> getRecentForUser(int userId, int limit) {
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        return aiChatHistoryRepo.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, boundedLimit));
    }

    public List<AiChatHistoryEntity> getConversation(int userId, String conversationId) {
        return aiChatHistoryRepo.findByUserIdAndConversationIdOrderByHistoryIdAsc(userId, conversationId);
    }

    public boolean deleteForUser(int historyId, int userId) {
        return aiChatHistoryRepo.findByHistoryIdAndUserId(historyId, userId)
            .map(history -> {
                aiChatHistoryRepo.delete(history);
                return true;
            })
            .orElse(false);
    }
}
