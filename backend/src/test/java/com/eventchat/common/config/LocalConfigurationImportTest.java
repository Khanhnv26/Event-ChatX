package com.eventchat.common.config;

import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;

class LocalConfigurationImportTest {
    @TempDir Path workspace;

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void importsLocalPropertiesFromBackendOrRepositoryRoot(boolean launchFromBackend) throws Exception {
        Path backend = Files.createDirectories(workspace.resolve("backend"));
        Files.writeString(backend.resolve("application-secrets.properties.local"),
                "spring.datasource.url=jdbc:mysql://localhost:3306/config_import_test\n"
                        + "spring.datasource.username=test_user\n"
                        + "spring.datasource.password=test_only\n");
        Properties application = new Properties();
        try (var input = getClass().getResourceAsStream("/application.properties")) {
            assertNotNull(input);
            application.load(input);
        }
        Path workingDirectory = launchFromBackend ? backend : workspace;
        String imports = application.getProperty("spring.config.import")
                .replace("file:./", workingDirectory.toUri().toString());
        new ApplicationContextRunner()
                .withInitializer(new ConfigDataApplicationContextInitializer())
                .withPropertyValues("spring.config.location=optional:classpath:/not-present.properties",
                        "spring.config.import=" + imports)
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    assertEquals("jdbc:mysql://localhost:3306/config_import_test",
                            context.getEnvironment().getProperty("spring.datasource.url"));
                    assertEquals("test_user", context.getEnvironment().getProperty("spring.datasource.username"));
                });
    }
}
