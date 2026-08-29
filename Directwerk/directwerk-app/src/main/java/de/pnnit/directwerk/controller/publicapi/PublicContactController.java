package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.marketing.ContactFormService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/contact")
public class PublicContactController {

    private final ContactFormService contactFormService;

    public PublicContactController(ContactFormService contactFormService) {
        this.contactFormService = contactFormService;
    }

    @PostMapping
    ResponseEntity<Response<ContactAcceptedResponse>> submit(@Valid @RequestBody ContactRequest body) {
        contactFormService.submit(body.name(), body.email(), body.message(), body.altcha());
        return ResponseEntity.accepted().body(Response.accepted(new ContactAcceptedResponse(true)));
    }

    public record ContactRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 5000) String message,
            @NotBlank String altcha
    ) {
    }

    public record ContactAcceptedResponse(boolean accepted) {
    }
}
