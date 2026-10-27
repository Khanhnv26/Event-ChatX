package com.eventchat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EventChatApplication {
    public static void main(String[] args) {
        SpringApplication.run(EventChatApplication.class, args);
    }
}
