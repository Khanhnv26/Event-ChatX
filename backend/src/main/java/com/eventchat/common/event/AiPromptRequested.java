package com.eventchat.common.event;

import java.util.regex.Pattern;

public record AiPromptRequested(String slug, Long roomId, String messageId, long sequence,
                                String threadRootId, String guestId, String tokenHash, String prompt, boolean summary) {
    private static final Pattern MENTION = Pattern.compile("(?iU)(?:^\\s*/ai|(?<!\\S)@ai)(?=\\s|$)");
    private static final Pattern SUMMARY = Pattern.compile("(?iU)^(?:tóm tắt|tổng hợp|summary|summarize)(?=\\W|$)");

    public static AiPromptRequested from(String slug, Long roomId, String messageId, Long sequence,
                                         String threadRootId, String guestId, String tokenHash, String body) {
        if (body == null || body.isBlank()) return null;
        var mention = MENTION.matcher(body);
        if (!mention.find()) return null;
        String prompt = (body.substring(0, mention.start()) + body.substring(mention.end())).strip();
        boolean summary = prompt.isEmpty() || SUMMARY.matcher(prompt).find();
        return new AiPromptRequested(slug, roomId, messageId, sequence, threadRootId, guestId, tokenHash,
                prompt.isEmpty() ? "Tóm tắt thảo luận" : prompt, summary);
    }

    @Override
    public String toString() {
        return "AiPromptRequested[messageId=" + messageId + "]";
    }
}
