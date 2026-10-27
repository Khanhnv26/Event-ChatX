package com.eventchat.infrastructure.redis;



public final class RedisKeys {

    private RedisKeys () {

    }

    public static String roomSeq(Long id) {
        return "room:" + id + ":seq";
    }

    public static String roomRecent(Long roomId){
        return "room:" + roomId + ":recent";
    }

    public static String roomInfo (String slug) {
        return "room:info:" + slug;
    }

    public static String session(String slug, String tokenHash) {
        return "session:" + slug + ":" + tokenHash;
    }
}
