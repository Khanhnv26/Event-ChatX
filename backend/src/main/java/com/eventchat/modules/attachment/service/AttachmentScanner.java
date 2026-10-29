package com.eventchat.modules.attachment.service;

import java.io.IOException;
import java.io.InputStream;

public interface AttachmentScanner {
    boolean isClean(InputStream input, long maxBytes) throws IOException;
}
