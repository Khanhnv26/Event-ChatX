package com.eventchat.common.ratelimit.interceptor;

import com.eventchat.common.ratelimit.enums.RateLimitAction;
import com.eventchat.common.ratelimit.model.RateLimitContext;
import com.eventchat.common.ratelimit.service.RateLimitService;
import com.eventchat.common.security.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PATCH", "PUT", "DELETE");
    private static final String ROOMS_PATH = "/api/v1/rooms";

    private final RateLimitService rateLimitService;
    private final ClientIpResolver clientIpResolver;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!WRITE_METHODS.contains(request.getMethod())) {
            return true;
        }
        Object mapping = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (!(mapping instanceof String path) || !path.startsWith(ROOMS_PATH)) {
            return true;
        }

        RateLimitAction action = resolveAction(path);
        String slug = roomSlug(request);
        if (action != RateLimitAction.CREATE_ROOM && slug == null) {
            return true;
        }
        String token = action.getTokenHeader() == null ? null : request.getHeader(action.getTokenHeader());
        rateLimitService.check(new RateLimitContext(action, clientIpResolver.resolve(request), slug, token));
        return true;
    }

    private RateLimitAction resolveAction(String path) {
        if (path.equals(ROOMS_PATH + "/{slug}/attachments/{publicId}/content")) {
            return RateLimitAction.UPLOAD_CONTENT;
        }
        if (path.equals(ROOMS_PATH)) {
            return RateLimitAction.CREATE_ROOM;
        }
        String lastSegment = path.substring(path.lastIndexOf('/') + 1);
        return switch (lastSegment) {
            case "join", "reconnect" -> RateLimitAction.JOIN_ROOM;
            case "messages" -> RateLimitAction.CHAT;
            case "votes", "confirm" -> RateLimitAction.VOTE;
            case "spin" -> RateLimitAction.SPIN;
            case "close", "status", "join-lock","kick" -> RateLimitAction.HOST_WRITE;
            case "attachments" -> RateLimitAction.UPLOAD_INTENT;
            default -> RateLimitAction.TOOL_CREATE;
        };
    }

    private String roomSlug(HttpServletRequest request) {
        Object attributes = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (attributes instanceof Map<?, ?> variables && variables.get("slug") instanceof String slug) {
            return slug;
        }
        return null;
    }
}
