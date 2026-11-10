package com.eventchat.modules.chat.repository;

import com.eventchat.modules.chat.entity.MessageReaction;
import com.eventchat.modules.chat.enums.ReactionEmoji;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MessageReactionRepository extends JpaRepository<MessageReaction, Long> {
    Optional<MessageReaction> findByRoomIdAndMessageIdAndSessionIdAndEmoji(
            Long roomId, String messageId, Long sessionId, ReactionEmoji emoji);

    @Query("""
            select r.messageId as messageId, r.emoji as emoji, count(r) as total,
                sum(case when r.sessionId = :sessionId then 1 else 0 end) as ownCount
            from MessageReaction r where r.roomId = :roomId and r.messageId in :messageIds
            group by r.messageId, r.emoji
            """)
    List<ReactionAggregate> summarize(Long roomId, Long sessionId, List<String> messageIds);

    interface ReactionAggregate {
        String getMessageId();
        ReactionEmoji getEmoji();
        long getTotal();
        long getOwnCount();
    }
}
