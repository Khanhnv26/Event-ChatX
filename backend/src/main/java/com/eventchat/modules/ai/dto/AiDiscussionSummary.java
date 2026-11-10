package com.eventchat.modules.ai.dto;

import com.eventchat.modules.chat.service.ChatService.AiContextLine;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public record AiDiscussionSummary(List<Item> decided, List<Item> open, List<Item> next) {
    private static final List<String> CATEGORIES = List.of("decided", "open", "next");
    private static final Map<String, Object> ITEM = Map.of("type", "object",
            "required", List.of("text", "sourceNumbers"),
            "properties", Map.of("text", Map.of("type", "string"), "sourceNumbers", Map.of(
                    "type", "array", "minItems", 1, "maxItems", 3, "items", Map.of("type", "integer"))));
    private static final Map<String, Object> ITEMS = Map.of("type", "array", "maxItems", 4, "items", ITEM);
    public static final Map<String, Object> SCHEMA = Map.of("type", "object",
            "required", CATEGORIES, "properties", Map.of("decided", ITEMS, "open", ITEMS, "next", ITEMS));

    public record Item(String text, List<Integer> sourceNumbers) {}

    public Resolved resolve(List<AiContextLine> context, boolean demo) {
        return new Resolved(resolve(decided, context), resolve(open, context), resolve(next, context),
                context.size(), demo);
    }

    public record Resolved(List<Map<String, Object>> decided, List<Map<String, Object>> open,
                           List<Map<String, Object>> next, int contextCount, boolean demo) {
        public Map<String, Object> metadata() {
            return Map.of("aiSummary", Map.of("decided", decided, "open", open, "next", next,
                    "contextCount", contextCount, "demo", demo));
        }

        public String plainText() {
            if (demo) return "Tóm tắt thảo luận · Chế độ thử nghiệm";
            if (contextCount == 0) return "Chưa có tin nhắn văn bản để tóm tắt.";
            var body = new StringBuilder("Tóm tắt thảo luận");
            appendSection(body, "Đã chốt", decided);
            appendSection(body, "Còn mở", open);
            appendSection(body, "Việc tiếp theo", next);
            return body.toString();
        }

        private static void appendSection(StringBuilder body, String title, List<Map<String, Object>> items) {
            body.append("\n\n").append(title);
            if (items.isEmpty()) body.append("\nChưa ghi nhận.");
            items.forEach(item -> body.append("\n• ").append(item.get("text")));
        }
    }

    public static AiDiscussionSummary empty() {
        return new AiDiscussionSummary(List.of(), List.of(), List.of());
    }

    private static List<Map<String, Object>> resolve(List<Item> items, List<AiContextLine> context) {
        if (items == null) return List.of();
        var result = new ArrayList<Map<String, Object>>();
        for (Item item : items) {
            if (item == null || item.text() == null || item.text().isBlank() || item.sourceNumbers() == null) continue;
            var sources = item.sourceNumbers().stream()
                    .filter(number -> number != null && number > 0 && number <= context.size())
                    .distinct().limit(3).map(number -> {
                        var source = context.get(number - 1);
                        return Map.of("id", source.messageId(), "number", number,
                                "speaker", source.speaker(), "excerpt", clip(source.text(), 180));
                    }).toList();
            if (!sources.isEmpty()) result.add(Map.of("text", clip(item.text().strip(), 300), "sources", sources));
            if (result.size() == 4) break;
        }
        return result;
    }

    public static String clip(String text, int limit) {
        if (text.length() <= limit) return text;
        int end = Character.isHighSurrogate(text.charAt(limit - 1)) ? limit - 1 : limit;
        return text.substring(0, end) + "…";
    }
}
