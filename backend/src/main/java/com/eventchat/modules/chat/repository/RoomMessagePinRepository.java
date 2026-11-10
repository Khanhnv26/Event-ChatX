package com.eventchat.modules.chat.repository;

import com.eventchat.modules.chat.entity.RoomMessagePin;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomMessagePinRepository extends JpaRepository<RoomMessagePin, Long> {}
