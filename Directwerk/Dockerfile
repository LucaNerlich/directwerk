# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY gradlew gradlew.bat gradle.properties settings.gradle build.gradle ./
COPY gradle ./gradle
COPY directwerk-common ./directwerk-common
COPY directwerk-core ./directwerk-core
COPY directwerk-digital ./directwerk-digital
COPY directwerk-email ./directwerk-email
COPY directwerk-newsletter ./directwerk-newsletter
COPY directwerk-podcast ./directwerk-podcast
COPY directwerk-queue ./directwerk-queue
COPY directwerk-subscription ./directwerk-subscription
COPY directwerk-app ./directwerk-app

RUN chmod +x gradlew \
    && ./gradlew :directwerk-app:bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl \
    && addgroup -S directwerk \
    && adduser -S directwerk -G directwerk

WORKDIR /app
COPY --from=build /workspace/directwerk-app/build/libs/directwerk-app.jar ./app.jar
RUN chown directwerk:directwerk app.jar

USER directwerk
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/actuator/health || exit 1

ENV JAVA_OPTS=""
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
