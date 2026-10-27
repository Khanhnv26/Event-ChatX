package com.eventchat.modules.room.repository;

import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.enums.RoomStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository  extends JpaRepository<Room, Long> {
    Optional<Room> findBySlug(String slug);
    boolean existsBySlug(String slug);

    @Query("select r.slug from Room r where r.roomStatus <> :expired and r.expiresAt <= :now")
    List<String> findSlugsToExpire(@Param("expired") RoomStatus expired, @Param("now") Instant now);

    @Modifying
    @Query("update Room r set r.roomStatus = :expired where r.slug in :slugs and r.roomStatus <> :expired")
    int maxExpired(@Param("expired") RoomStatus expired, @Param("slugs") List<String> slugs);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select r
        from Room r
        where r.slug = :slug
        """)
    Optional<Room> findBySlugForUpdate(@Param("slug") String slug);
}
