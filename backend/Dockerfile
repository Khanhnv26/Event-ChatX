FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S eventchat && adduser -S eventchat -G eventchat
WORKDIR /app
RUN mkdir -p /app/artifacts/uploads && chown -R eventchat:eventchat /app/artifacts
COPY --from=build --chown=eventchat:eventchat /build/target/backend-0.0.1-SNAPSHOT.jar app.jar
USER eventchat
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD wget -q -O - http://localhost:8080/internal/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "app.jar"]
