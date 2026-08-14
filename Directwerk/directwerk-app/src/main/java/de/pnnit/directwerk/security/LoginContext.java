package de.pnnit.directwerk.security;

public final class LoginContext {

    private static final ThreadLocal<Boolean> PLATFORM_ADMIN_LOGIN = ThreadLocal.withInitial(() -> false);

    private LoginContext() {
    }

    public static void setPlatformAdminLogin(boolean platformAdminLogin) {
        PLATFORM_ADMIN_LOGIN.set(platformAdminLogin);
    }

    public static boolean isPlatformAdminLogin() {
        return Boolean.TRUE.equals(PLATFORM_ADMIN_LOGIN.get());
    }

    public static void clear() {
        PLATFORM_ADMIN_LOGIN.remove();
    }
}
