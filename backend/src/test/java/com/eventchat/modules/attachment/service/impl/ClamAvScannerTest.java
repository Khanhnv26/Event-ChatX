package com.eventchat.modules.attachment.service.impl;

import com.eventchat.modules.attachment.config.AttachmentScanProperties;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

class ClamAvScannerTest {
    @ParameterizedTest
    @ValueSource(strings = {"stream: OK", "stream: Test-Signature FOUND", "stream: Scanner ERROR"})
    void usesBoundedInstreamFramesAndOnlyAcceptsAnExplicitCleanVerdict(String verdict) throws Exception {
        try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            AttachmentScanProperties properties = new AttachmentScanProperties();
            properties.setHost(InetAddress.getLoopbackAddress().getHostAddress());
            properties.setPort(server.getLocalPort());
            properties.setTimeoutMillis(2000);
            ExecutorService executor = Executors.newSingleThreadExecutor();
            try {
                Future<?> daemon = executor.submit(() -> {
                    try (Socket socket = server.accept()) {
                        DataInputStream input = new DataInputStream(socket.getInputStream());
                        assertThat(new String(input.readNBytes(10), StandardCharsets.US_ASCII)).isEqualTo("zINSTREAM\0");
                        int size = input.readInt();
                        assertThat(size).isEqualTo(5);
                        assertThat(input.readNBytes(size)).isEqualTo("notes".getBytes(StandardCharsets.UTF_8));
                        assertThat(input.readInt()).isZero();
                        socket.getOutputStream().write((verdict + "\0").getBytes(StandardCharsets.US_ASCII));
                    } catch (IOException ex) { throw new UncheckedIOException(ex); }
                });
                ClamAvScanner scanner = new ClamAvScanner(properties);
                if (verdict.endsWith("ERROR")) {
                    assertThatThrownBy(() -> scanner.isClean(new ByteArrayInputStream("notes".getBytes()), 20))
                            .isInstanceOf(IOException.class);
                } else {
                    assertThat(scanner.isClean(new ByteArrayInputStream("notes".getBytes()), 20)).isEqualTo(verdict.endsWith("OK"));
                }
                daemon.get(5, TimeUnit.SECONDS);
            } finally { executor.shutdownNow(); }
        }
    }
}
