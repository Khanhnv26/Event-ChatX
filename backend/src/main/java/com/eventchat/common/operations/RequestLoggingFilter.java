package com.eventchat.common.operations;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.MDC;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;
import java.util.UUID;

@Component
@Slf4j
public class RequestLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String correlation = UUID.randomUUID().toString();
        response.setHeader("X-Request-Id", correlation);
        response.setHeader("Cache-Control", "no-store");
        MDC.put("requestId", correlation);
        long start = System.nanoTime();
        try { chain.doFilter(request, response); }
        finally {
            long elapsed = System.nanoTime() - start;
            log.info("requestId={} method={} path={} status={} durationMs={}", correlation,
                    request.getMethod(), request.getRequestURI(), response.getStatus(), elapsed / 1000000);
            MDC.remove("requestId");
        }
    }
}
