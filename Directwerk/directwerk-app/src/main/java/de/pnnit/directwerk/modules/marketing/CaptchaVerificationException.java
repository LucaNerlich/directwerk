package de.pnnit.directwerk.modules.marketing;

public class CaptchaVerificationException extends RuntimeException {

    public CaptchaVerificationException() {
        super("CAPTCHA verification failed");
    }
}
