package com.eventchat.common.config;

import com.eventchat.common.security.CorsConfig;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.CorsFilter;

import java.util.Properties;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class DevelopmentCorsTest {
    private ApplicationContextRunner context() throws Exception {
        Properties properties = new Properties();
        try (var input = getClass().getResourceAsStream("/application.properties")) {
            assertNotNull(input);
            properties.load(input);
        }
        var runner = new ApplicationContextRunner().withUserConfiguration(CorsConfig.class);
        String origins = properties.getProperty("app.allowed-origins");
        return origins == null ? runner : runner.withPropertyValues("app.allowed-origins=" + origins);
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:4000", "http://127.0.0.1:4000", "http://localhost:5173"})
    void allowsLocalDevelopmentFrontend(String origin) throws Exception {
        context().run(context -> {
            var request = new MockHttpServletRequest("POST", "/api/v1/rooms");
            request.setServerName("localhost"); request.setServerPort(8080);
            request.addHeader("Origin", origin);
            var response = new MockHttpServletResponse();
            var reachedController = new AtomicBoolean();
            context.getBean(CorsFilter.class).doFilter(request, response,
                    (req, res) -> reachedController.set(true));
            assertEquals(200, response.getStatus(), response.getContentAsString());
            assertEquals(origin, response.getHeader("Access-Control-Allow-Origin"));
            assertTrue(reachedController.get());
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:4000", "https://untrusted.example"})
    void productionOriginOverrideDoesNotAllowDevelopmentOrUntrustedOrigins(String origin) {
        new ApplicationContextRunner().withUserConfiguration(CorsConfig.class)
                .withPropertyValues("app.allowed-origins=https://chat.example.com")
                .run(context -> {
                    var request = new MockHttpServletRequest("POST", "/api/v1/rooms");
                    request.setServerName("localhost"); request.setServerPort(8080);
                    request.addHeader("Origin", origin);
                    var response = new MockHttpServletResponse();
                    context.getBean(CorsFilter.class).doFilter(request, response,
                            (req, res) -> fail("Rejected origin must not reach controller"));
                    assertEquals(403, response.getStatus());
                });
    }
}
