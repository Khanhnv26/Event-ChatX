package com.eventchat.common.security;

import com.eventchat.common.ratelimit.config.RateLimitProperties;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;

@Component
@RequiredArgsConstructor
public class ClientIpResolver {

    private static final int MAX_FORWARDED_HEADER_LENGTH = 2048;
    private static final int MAX_IP_LENGTH = 45;

    private final RateLimitProperties properties;

    public String resolve(HttpServletRequest request) {
        String address = request.getRemoteAddr();
        if (!properties.getTrustedProxies().contains(address)) {
            return address;
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.length() > MAX_FORWARDED_HEADER_LENGTH) {
            return address;
        }

        String[] chain = forwarded.split(",", -1);
        for (int i = chain.length - 1; i >= 0 && properties.getTrustedProxies().contains(address); i--) {
            String candidate = chain[i].trim();
            if (!isIpLiteral(candidate)) {
                return request.getRemoteAddr();
            }
            try {
                address = InetAddress.getByName(candidate).getHostAddress();
            } catch (UnknownHostException error) {
                return request.getRemoteAddr();
            }
        }
        return address;
    }

    private boolean isIpLiteral(String candidate) {
        if (candidate.length() > MAX_IP_LENGTH || !candidate.matches("[0-9a-fA-F:.]+")) {
            return false;
        }
        return candidate.contains(":") || candidate.matches("\\d{1,3}(\\.\\d{1,3}){3}");
    }
}
