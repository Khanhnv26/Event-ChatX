package com.eventchat.common.operations;

import com.eventchat.common.exception.GlobalExceptionHandler;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = MetricsIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"management.server.port=0", "spring.flyway.enabled=false"})
@AutoConfigureObservability
class MetricsIntegrationTest {
    @Autowired private TestRestTemplate http;
    @LocalManagementPort private int managementPort;

    @Test void publishesHttpHistogramsAndJvmMetricsOnlyOnManagementPort() {
        ResponseEntity<String> response = http.getForEntity("/metrics-test/first", String.class);
        http.getForEntity("/metrics-test/second", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst("X-Request-Id")).isNotBlank();
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");

        ResponseEntity<String> scrape = http.getForEntity("http://localhost:" + managementPort + "/actuator/prometheus", String.class);
        assertThat(scrape.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(scrape.getBody()).contains("http_server_requests_seconds_bucket", "uri=\"/metrics-test/{id}\"",
                "jvm_memory_used_bytes", "process_cpu_usage");
        String serverMetrics = scrape.getBody().lines().filter(line -> line.startsWith("http_server_requests_"))
                .collect(Collectors.joining("\n"));
        assertThat(serverMetrics).doesNotContain("uri=\"/metrics-test/first\"");
        assertThat(scrape.getBody()).doesNotContain("eventchat_http_requests_total");
        assertThat(http.getForEntity("/actuator/prometheus", String.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(http.getForEntity("http://localhost:" + managementPort + "/actuator/env", String.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration(exclude = {DataSourceAutoConfiguration.class, MongoAutoConfiguration.class,
            MongoDataAutoConfiguration.class, RedisAutoConfiguration.class, RabbitAutoConfiguration.class})
    @Import({RequestLoggingFilter.class, GlobalExceptionHandler.class})
    static class TestApplication {
        @Bean TestController testController() { return new TestController(); }
    }

    @Test void unmappedApiReturnsNotFoundInsteadOfAnInternalServerError() {
        ResponseEntity<String> response = http.getForEntity("/api/v1/no-such-route", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"success\":false");
    }

    @RestController
    static class TestController {
        @GetMapping("/metrics-test/{id}") String request(@PathVariable String id) { return id; }
    }
}
