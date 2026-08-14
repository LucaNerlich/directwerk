package de.pnnit.directwerk.docs;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Validates the IntelliJ HTTP Client fixtures under {@code Directwerk/http/} and their reference
 * from {@code projects/publish/AGENTS.md}.
 *
 * <p>This PR renumbered/renamed the manual API test scripts (e.g. {@code 06-tenant-admin.http} ->
 * {@code 10-tenant-admin.http}), replaced {@code http-client.secrets.example.json} with
 * {@code http-client.private.env.example.json}, added a {@code 00-index.http} table of contents,
 * and fixed the {@code AGENTS.md} link that previously pointed at the (non-existent) {@code http/}
 * directory instead of {@code Directwerk/http/}. These tests guard against regressions in that
 * structure since none of it is exercised by the Gradle {@code test} task otherwise.
 *
 * <p>The environment JSON fixtures are simple flat {@code "key": "value"} maps, so they are parsed
 * with a small regex here rather than pulling in a JSON library dependency for a test.
 */
class HttpClientFixturesTest {

    private static final Pattern NAME_ANNOTATION = Pattern.compile("^###\\s+@name\\s+(\\S+)$", Pattern.MULTILINE);
    private static final Pattern HANDLEBAR_VARIABLE = Pattern.compile("\\{\\{([a-zA-Z0-9_]+)\\}\\}");
    private static final Pattern GLOBAL_SET = Pattern.compile("client\\.global\\.set\\(\"([a-zA-Z0-9_]+)\"");
    private static final Pattern INDEX_TABLE_ROW = Pattern.compile(
            "^###\\s+\\|\\s+(\\d{2}-[a-zA-Z0-9-]+\\.http)\\s+\\|", Pattern.MULTILINE);
    private static final Pattern FLAT_JSON_STRING_ENTRY = Pattern.compile(
            "\"([a-zA-Z0-9_]+)\"\\s*:\\s*\"([^\"]*)\"");

    private static Path httpDir;
    private static Path agentsMd;
    private static List<Path> httpFiles;

    @BeforeAll
    static void locateFixtures() throws IOException {
        httpDir = resolveHttpDir();
        agentsMd = httpDir.getParent().getParent().resolve("AGENTS.md");
        assertThat(Files.isRegularFile(agentsMd))
                .as("AGENTS.md should exist next to the Directwerk module at %s", agentsMd)
                .isTrue();

        try (Stream<Path> files = Files.list(httpDir)) {
            httpFiles = files
                    .filter(p -> p.getFileName().toString().endsWith(".http"))
                    .sorted()
                    .collect(Collectors.toList());
        }
        assertThat(httpFiles).isNotEmpty();
    }

    private static Path resolveHttpDir() {
        List<Path> candidates = List.of(
                Paths.get("http"),
                Paths.get("projects/publish/Directwerk/http"),
                Paths.get("Directwerk/http")
        );
        for (Path candidate : candidates) {
            Path absolute = candidate.toAbsolutePath();
            if (isHttpFixtureDir(absolute)) {
                return absolute;
            }
        }
        Path dir = Paths.get("").toAbsolutePath();
        while (dir != null) {
            Path direct = dir.resolve("http");
            if (isHttpFixtureDir(direct)) {
                return direct;
            }
            Path nested = dir.resolve("Directwerk").resolve("http");
            if (isHttpFixtureDir(nested)) {
                return nested;
            }
            dir = dir.getParent();
        }
        throw new IllegalStateException("Could not locate Directwerk/http fixtures directory from "
                + Paths.get("").toAbsolutePath());
    }

    private static boolean isHttpFixtureDir(Path path) {
        return Files.isDirectory(path) && Files.exists(path.resolve("00-index.http"));
    }

    private static String read(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Parses the flat {@code "key": "value"} entries out of a simple JSON object. */
    private static Map<String, String> readFlatJsonStringValues(Path path) {
        Map<String, String> values = new HashMap<>();
        Matcher matcher = FLAT_JSON_STRING_ENTRY.matcher(read(path));
        while (matcher.find()) {
            values.put(matcher.group(1), matcher.group(2));
        }
        return values;
    }

    // --- Directory contents ---------------------------------------------------------------

    @Test
    void httpDirectoryContainsExactlyTheExpectedFixtureFiles() {
        List<String> httpNames = httpFiles.stream().map(p -> p.getFileName().toString()).sorted().toList();

        assertThat(httpNames).containsExactly(
                "00-index.http",
                "01-health.http",
                "02-oauth2.http",
                "03-auth.http",
                "04-me.http",
                "05-public.http",
                "06-platform-tenants.http",
                "07-platform-modules.http",
                "08-platform-admins.http",
                "09-platform-tenant-users.http",
                "10-tenant-admin.http",
                "11-tenant-products.http",
                "12-tenant-subscriptions.http",
                "13-module-probes.http",
                "14-security-probes.http",
                "15-multi-tenant-isolation.http",
                "16-platform-audit.http",
                "17-media-upload.http",
                "18-platform-tenant-media.http",
                "19-podcast-content.http",
                "20-episode-stream.http",
                "21-public-rss.http",
                "22-private-rss.http",
                "23-entitlements.http",
                "24-articles.http",
                "25-tenant-subscriber-feeds.http",
                "26-stripe-billing.http"
        );
        assertThat(Files.exists(httpDir.resolve("http-client.env.json"))).isTrue();
        assertThat(Files.exists(httpDir.resolve("http-client.private.env.example.json"))).isTrue();
    }

    @Test
    void legacyFileNamesFromBeforeTheRenumberingNoLongerExist() {
        List<String> removedOrRenamedAway = List.of(
                "00-health.http",
                "01-platform-auth.http",
                "02-platform-tenants.http",
                "03-platform-modules.http",
                "04-platform-users.http",
                "05-tenant-auth.http",
                "06-tenant-admin.http",
                "07-public-api.http",
                "08-module-probes.http",
                "09-multi-tenant-isolation.http",
                "10-role-enforcement.http",
                "11-security-stack.http",
                "12-subscriptions.http",
                "13-api-index.http",
                "http-client.secrets.example.json"
        );

        for (String legacyName : removedOrRenamedAway) {
            assertThat(Files.exists(httpDir.resolve(legacyName)))
                    .as("legacy fixture %s should have been removed or renamed", legacyName)
                    .isFalse();
        }
    }

    // --- 00-index.http table of contents ---------------------------------------------------

    @Test
    void indexFileListsEveryNumberedHttpFileInAscendingOrder() {
        String indexContent = read(httpDir.resolve("00-index.http"));

        List<String> listedInTable = new ArrayList<>();
        Matcher matcher = INDEX_TABLE_ROW.matcher(indexContent);
        while (matcher.find()) {
            listedInTable.add(matcher.group(1));
        }

        List<String> actualNumberedFiles = httpFiles.stream()
                .map(p -> p.getFileName().toString())
                .filter(name -> name.matches("^\\d{2}-.*\\.http$") && !name.equals("00-index.http"))
                .sorted()
                .toList();

        assertThat(listedInTable)
                .as("00-index.http table of contents must document every numbered fixture, in order")
                .containsExactlyElementsOf(actualNumberedFiles);
    }

    @Test
    void indexFileReferencesThePrivateEnvExampleFileThatActuallyExists() {
        String indexContent = read(httpDir.resolve("00-index.http"));

        assertThat(indexContent).contains("http-client.private.env.example.json");
        assertThat(Files.exists(httpDir.resolve("http-client.private.env.example.json")))
                .as("the file referenced by 00-index.http's setup instructions must exist")
                .isTrue();
    }

    @Test
    void indexFileDeclaresAHealthSmokeRequest() {
        String indexContent = read(httpDir.resolve("00-index.http"));

        assertThat(indexContent).contains("### @name healthSmoke");
        assertThat(indexContent).contains("GET {{baseUrl}}/actuator/health");
    }

    // --- Structural sanity of every fixture file --------------------------------------------

    @Test
    void everyHttpFileDeclaresAtLeastOneUniquelyNamedRequest() {
        for (Path file : httpFiles) {
            String content = read(file);

            List<String> names = new ArrayList<>();
            Matcher matcher = NAME_ANNOTATION.matcher(content);
            while (matcher.find()) {
                names.add(matcher.group(1));
            }

            assertThat(names)
                    .as("%s should declare at least one '### @name' request", file.getFileName())
                    .isNotEmpty();
            assertThat(names)
                    .as("%s should not declare duplicate request names", file.getFileName())
                    .doesNotHaveDuplicates();
        }
    }

    @Test
    void everyHttpFileStartsWithADescriptiveHeaderComment() {
        for (Path file : httpFiles) {
            String firstLine = read(file).lines().findFirst().orElse("");
            assertThat(firstLine)
                    .as("%s should start with a '### Directwerk' header comment", file.getFileName())
                    .startsWith("### Directwerk");
        }
    }

    // --- Variable resolution across the whole suite -----------------------------------------

    @Test
    void everyHandlebarVariableIsDefinedByEnvironmentOrCapturedAtRuntime() {
        Set<String> known = new HashSet<>();
        known.addAll(readFlatJsonStringValues(httpDir.resolve("http-client.env.json")).keySet());
        known.addAll(readFlatJsonStringValues(httpDir.resolve("http-client.private.env.example.json")).keySet());

        for (Path file : httpFiles) {
            String content = read(file);
            Matcher setMatcher = GLOBAL_SET.matcher(content);
            while (setMatcher.find()) {
                known.add(setMatcher.group(1));
            }
        }

        Set<String> unresolved = new HashSet<>();
        for (Path file : httpFiles) {
            String content = read(file);
            Matcher varMatcher = HANDLEBAR_VARIABLE.matcher(content);
            while (varMatcher.find()) {
                String variable = varMatcher.group(1);
                if (!known.contains(variable)) {
                    unresolved.add(file.getFileName() + ":" + variable);
                }
            }
        }

        assertThat(unresolved)
                .as("every {{variable}} must be defined in http-client.env.json, "
                        + "http-client.private.env.example.json, or captured via client.global.set")
                .isEmpty();
    }

    @Test
    void publicEnvJsonDoesNotAccidentallyContainSecretKeys() {
        Set<String> publicKeys = readFlatJsonStringValues(httpDir.resolve("http-client.env.json")).keySet();
        Set<String> secretKeys = readFlatJsonStringValues(
                httpDir.resolve("http-client.private.env.example.json")).keySet();

        Set<String> overlap = new HashSet<>(publicKeys);
        overlap.retainAll(secretKeys);

        assertThat(overlap)
                .as("secrets defined in http-client.private.env.example.json must not also live "
                        + "in the committed public http-client.env.json")
                .isEmpty();
    }

    @Test
    void httpClientEnvJsonDefinesTheCoreDevVariables() {
        Map<String, String> devEnv = readFlatJsonStringValues(httpDir.resolve("http-client.env.json"));

        assertThat(devEnv.get("baseUrl")).isEqualTo("http://localhost:8080");
        assertThat(devEnv.get("tenantAHost")).isNotBlank();
        assertThat(devEnv.get("tenantBHost")).isNotBlank();
        assertThat(devEnv.get("tenantAHost")).isNotEqualTo(devEnv.get("tenantBHost"));
        assertThat(devEnv.get("platformClientId")).isNotBlank();
        assertThat(devEnv.get("oauthClientId")).isNotBlank();
        assertThat(devEnv.get("platformAdminEmail")).contains("@");
        assertThat(devEnv.get("subscriberEmail")).contains("@");
    }

    @Test
    void httpClientPrivateEnvExampleDefinesThePlaceholderSecrets() {
        Map<String, String> devSecrets = readFlatJsonStringValues(
                httpDir.resolve("http-client.private.env.example.json"));

        assertThat(devSecrets.get("platformClientSecret")).isNotBlank();
        assertThat(devSecrets.get("oauthClientSecret")).isNotBlank();
        assertThat(devSecrets.get("platformAdminPassword")).isNotBlank();
        assertThat(devSecrets.get("seedPassword")).isNotBlank();
    }

    // --- AGENTS.md ---------------------------------------------------------------------------

    @Test
    void agentsMdLinksToTheRenamedDirectwerkHttpDirectory() {
        String content = read(agentsMd);

        assertThat(content)
                .as("AGENTS.md should point at the Directwerk/http directory, not the removed top-level http/")
                .contains("[`Directwerk/http/`](Directwerk/http/)");
        assertThat(content)
                .as("AGENTS.md must not regress to the old broken link target")
                .doesNotContain("[`http/`](http/)");
    }

    @Test
    void agentsMdHttpLinkTargetActuallyExistsOnDisk() {
        Path linked = agentsMd.getParent().resolve("Directwerk/http");

        assertThat(Files.isDirectory(linked))
                .as("the directory referenced by AGENTS.md's manual API tests link must exist")
                .isTrue();
        assertThat(linked).isEqualTo(httpDir);
    }
}
