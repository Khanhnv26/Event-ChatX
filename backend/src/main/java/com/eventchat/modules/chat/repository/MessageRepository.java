package com.eventchat.modules.chat.repository;

import com.eventchat.modules.chat.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {
    long deleteByRoomId(Long roomId);

    Optional<Message> findByRoomIdAndClientMessageId(Long roomId, String clientMessageId);

    Optional<Message> findTopByRoomIdOrderBySequenceDesc(Long roomId);

    @Query(value = "{'roomId': ?0, 'threadRootId': null, 'sequence': {'$gt': ?1}}", sort = "{'sequence': 1}")
    List<Message> findByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(Long roomId, Long afterSequence, Pageable pageable);

    @Query(value = "{'roomId': ?0, 'threadRootId': null}", sort = "{'sequence': -1}")
    List<Message> findByRoomIdOrderBySequenceDesc(Long roomId, Pageable pageable);

    List<Message> findByRoomIdAndThreadRootIdAndSequenceGreaterThanOrderBySequenceAsc(Long roomId, String threadRootId, Long afterSequence, Pageable pageable);
    long countByRoomIdAndThreadRootId(Long roomId, String threadRootId);

    @Aggregation(pipeline = {"{'$match': {'roomId': ?0, 'threadRootId': {'$in': ?1}}}",
            "{'$group': {'_id': '$threadRootId', 'count': {'$sum': 1}}}"})
    List<ThreadReplyCount> countThreadReplies(Long roomId, List<String> rootIds);

    List<Message> findByRoomIdAndIdIn(Long roomId, List<String> ids);

    @Aggregation(pipeline = {"{'$match': {'roomId': ?0, 'threadRootId': {'$type': 'string'}}}",
            "{'$sort': {'sequence': -1}}",
            "{'$group': {'_id': '$threadRootId', 'replyCount': {'$sum': 1}, 'lastActivitySequence': {'$first': '$sequence'}, 'lastActivityAt': {'$first': '$createdAt'}, 'lastReplySnippet': {'$first': '$body'}}}",
            "{'$match': {'lastActivitySequence': {'$lt': ?1}}}",
            "{'$sort': {'lastActivitySequence': -1}}", "{'$limit': 51}"})
    List<ThreadActivity> findThreadActivities(Long roomId, Long beforeActivitySequence);

    List<Message> findTop25ByAttachmentLinkPendingTrueOrderByCreatedAtAsc();
}
