package com.eventchat.common.operations;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.MDC;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.atomic.LongAdder;

@Component
@Slf4j
public class RequestMetricsFilter extends OncePerRequestFilter {
    private final LongAdder requests = new LongAdder();
    private final LongAdder errors = new LongAdder();
    private final LongAdder limited = new LongAdder();
    private final LongAdder nanos = new LongAdder();

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
            requests.increment(); nanos.add(elapsed);
            if (response.getStatus() >= 500) errors.increment();
            if (response.getStatus() == 429) limited.increment();
            log.info("requestId={} method={} path={} status={} durationMs={}", correlation,
                    request.getMethod(), request.getRequestURI(), response.getStatus(), elapsed / 1000000);
            MDC.remove("requestId");
        }
    }
    public String scrape() {
        return "eventchat_http_requests_total " + requests.sum() + "\n"
                + "eventchat_http_errors_total " + errors.sum() + "\n"
                + "eventchat_http_rate_limited_total " + limited.sum() + "\n"
                + "eventchat_http_duration_seconds_sum " + nanos.sum() / 1_000_000_000.0 + "\n";
    }
}
