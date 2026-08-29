package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.modules.marketing.AltchaService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/altcha")
public class PublicAltchaController {

    private final AltchaService altchaService;

    public PublicAltchaController(AltchaService altchaService) {
        this.altchaService = altchaService;
    }

    @GetMapping(value = "/challenge", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<String> challenge() {
        return ResponseEntity.ok(altchaService.createChallengeJson());
    }
}
