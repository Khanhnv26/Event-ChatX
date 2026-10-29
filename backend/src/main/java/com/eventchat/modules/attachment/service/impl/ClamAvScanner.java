package com.eventchat.modules.attachment.service.impl;

import com.eventchat.modules.attachment.config.AttachmentScanProperties;
import com.eventchat.modules.attachment.service.AttachmentScanner;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class ClamAvScanner implements AttachmentScanner {
    private final AttachmentScanProperties properties;

    @Override
    public boolean isClean(InputStream input, long maxBytes) throws IOException {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(properties.getHost(), properties.getPort()), properties.getTimeoutMillis());
            socket.setSoTimeout(properties.getTimeoutMillis());
            DataOutputStream output = new DataOutputStream(socket.getOutputStream());
            output.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));
            byte[] buffer = new byte[8192];
            long sent = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (count == 0) continue;
                if (count > maxBytes - sent) throw new IOException("Scanner stream limit exceeded");
                output.writeInt(count);
                output.write(buffer, 0, count);
                sent += count;
            }
            output.writeInt(0);
            output.flush();
            ByteArrayOutputStream response = new ByteArrayOutputStream();
            InputStream reply = socket.getInputStream();
            int value;
            while ((value = reply.read()) != -1 && value != 0 && value != '\n') {
                if (response.size() >= 4096) throw new IOException("Invalid scanner response");
                response.write(value);
            }
            String result = response.toString(StandardCharsets.US_ASCII);
            if (result.equals("stream: OK")) return true;
            if (result.startsWith("stream: ") && result.endsWith(" FOUND")) return false;
            throw new IOException("Scanner did not confirm a verdict");
        }
    }
}
