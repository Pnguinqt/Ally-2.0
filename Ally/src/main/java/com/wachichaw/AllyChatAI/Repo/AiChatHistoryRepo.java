package com.wachichaw.AllyChatAI.Repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wachichaw.AllyChatAI.Entity.AiChatHistoryEntity;

@Repository
public interface AiChatHistoryRepo extends JpaRepository<AiChatHistoryEntity, Integer> {
    List<AiChatHistoryEntity> findByUserIdAndConversationIdOrderByHistoryIdAsc(int userId, String conversationId);
    @org.springframework.data.jpa.repository.Query("SELECT h FROM AiChatHistoryEntity h WHERE h.userId = :userId AND (h.conversationId IS NULL OR h.historyId = (SELECT MAX(t.historyId) FROM AiChatHistoryEntity t WHERE t.userId = :userId AND t.conversationId = h.conversationId)) ORDER BY h.createdAt DESC")
    List<AiChatHistoryEntity> findByUserIdOrderByCreatedAtDesc(int userId, Pageable pageable);
    Optional<AiChatHistoryEntity> findByHistoryIdAndUserId(int historyId, int userId);
}
