package com.eventchat.modules.interaction.poll.enums;

public enum PollType {
    SINGLE, MULTIPLE, RATING, RANKING;

    public static PollType fromRule(String rule) {
        if ("MULTIPLE".equals(rule)) return MULTIPLE;
        if ("RATING".equals(rule)) return RATING;
        if ("RANKING".equals(rule)) return RANKING;
        return SINGLE;
    }

    public int maxChoices() {
        return switch (this) {
            case SINGLE, RATING -> 1;
            case MULTIPLE -> 10;
            case RANKING -> 3;
        };
    }
}
