package com.eventchat.infrastructure.storage.service;

import com.eventchat.infrastructure.storage.model.StoredObject;

import java.io.IOException;
import java.io.InputStream;

public interface StorageService {
    StoredObject put(InputStream input, long maxBytes) throws IOException;
    StoredObject put(String key, InputStream input, long maxBytes) throws IOException;
    StoredObject replace(String key, InputStream input, long maxBytes) throws IOException;
    InputStream open(String key) throws IOException;
    boolean delete(String key) throws IOException;
}
