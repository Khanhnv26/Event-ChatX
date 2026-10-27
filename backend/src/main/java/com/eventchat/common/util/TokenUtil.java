package com.eventchat.common.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

public final class TokenUtil {
    private static final String SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private TokenUtil() {
    }

    public static String generateSlug(){
        StringBuilder sb = new StringBuilder(9);

        for (int i = 0; i< 8; i++) {
            if (i == 4){
                sb.append('-');
            } else {
                int randomIndex = SECURE_RANDOM.nextInt(SLUG_ALPHABET.length());
                sb.append(SLUG_ALPHABET.charAt(randomIndex));
            }
        }
        return sb.toString();
    }

    public static String generateSecretToken() {
        byte[] randomBytes = new byte[32];
        SECURE_RANDOM.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    public static String sha256(String rawToken) {
         try {
             MessageDigest digest = MessageDigest.getInstance("SHA-256");
             byte[] hashBytes = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));

             return HexFormat.of().formatHex(hashBytes);
         } catch (NoSuchAlgorithmException e) {
             throw new IllegalStateException("Thuật toán SHA-256 không khả dụng", e);
         }
    }
}
