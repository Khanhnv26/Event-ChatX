package com.eventchat.infrastructure.websocket;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final StompAuthorizationInterceptor authorization;
    private final StompOutboundGuard outboundGuard;
    private final RealtimeSessionRegistry sessions;

    @Value("${app.allowed-origins:http://localhost:5173,http://localhost:8080}")
    private String[] allowedOrigins;

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authorization);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.interceptors(outboundGuard);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(8192).setSendBufferSizeLimit(65536).setSendTimeLimit(10000)
                .setTimeToFirstMessage(10000);
        registration.addDecoratorFactory(handler -> new WebSocketHandlerDecorator(handler) {
            @Override public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessions.track(session);
                super.afterConnectionEstablished(session);
            }
            @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                sessions.remove(session.getId());
                super.afterConnectionClosed(session, status);
            }
        });
    }

    @Value("${app.stomp.relay.host:localhost}")
    private String relayHost;

    @Value("${app.stomp.relay.port:61613}")
    private int relayPort;

    @Value("${app.stomp.relay.login:eventchat_rabbit}")
    private String relayLogin;

    @Value("${app.stomp.relay.passcode:eventchat_rabbit_pass}")
    private String relayPasscode;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableStompBrokerRelay("/topic", "/queue")
                .setRelayHost(relayHost)
                .setRelayPort(relayPort)
                .setClientLogin(relayLogin)
                .setClientPasscode(relayPasscode)
                .setSystemLogin(relayLogin)
                .setSystemPasscode(relayPasscode);
    }
}
