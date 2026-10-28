# Security

Do not publish tokens, room transcripts, deployment credentials or exploit details in public issues. Report a suspected vulnerability privately to the repository owner through the hosting platform's private reporting channel if enabled; otherwise arrange a private channel with the owner before sharing sensitive details.

Tokens grant room-scoped bearer access. REST verifies SQL session revocation; STOMP accepts authenticated CONNECT and an exact allowlist of room topics, blocks client SEND, revalidates outbound messages and closes revoked idle sockets. Configure exact allowed origins and HTTPS. Keep `/internal` endpoints and service ports private. Anonymous identity bans and lost-Host-token recovery are outside V1.
