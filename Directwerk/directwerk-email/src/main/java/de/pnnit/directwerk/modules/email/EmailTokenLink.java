package de.pnnit.directwerk.modules.email;

public enum EmailTokenLink {
    STUDIO_ACCEPT_INVITE("acceptInviteUrl"),
    ADMIN_ACCEPT_INVITE("acceptInviteUrl"),
    RESET_PASSWORD("resetUrl"),
    EMAIL_VERIFICATION("verifyUrl"),
    NEWSLETTER_CONFIRM("confirmUrl");

    private final String variableName;

    EmailTokenLink(String variableName) {
        this.variableName = variableName;
    }

    public String variableName() {
        return variableName;
    }
}
