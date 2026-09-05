package de.pnnit.directwerk.controller.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudioAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void workspacesIsPublicAndReturnsInvalidCredentialsForUnknownUser() throws Exception {
        mockMvc.perform(post("/api/v1/auth/studio/workspaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "unknown-%s@example.com",
                                  "password": "ValidPassword12!"
                                }
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errors[0].code").value("INVALID_CREDENTIALS"));
    }
}
