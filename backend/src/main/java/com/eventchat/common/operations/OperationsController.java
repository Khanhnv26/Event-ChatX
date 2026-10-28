package com.eventchat.common.operations;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.*;
import org.springframework.messaging.simp.broker.BrokerAvailabilityEvent;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class OperationsController {
    private final JdbcTemplate sql;
    private final MongoTemplate mongo;
    private final StringRedisTemplate redis;
    private final RequestMetricsFilter metrics;
    private volatile boolean brokerAvailable;

    @EventListener public void brokerState(BrokerAvailabilityEvent event) { brokerAvailable = event.isBrokerAvailable(); }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        try {
            sql.queryForObject("SELECT 1", Integer.class);
            mongo.executeCommand("{ping:1}");
            try (var connection = redis.getConnectionFactory().getConnection()) { connection.ping(); }
            if (!brokerAvailable) return ResponseEntity.status(503).body(Map.of("status", "DOWN"));
            return ResponseEntity.ok(Map.of("status", "UP"));
        } catch (RuntimeException unavailable) {
            return ResponseEntity.status(503).body(Map.of("status", "DOWN"));
        }
    }
    @GetMapping(value = "/metrics", produces = MediaType.TEXT_PLAIN_VALUE)
    public String metrics() { return metrics.scrape(); }
}
