package de.pnnit.directwerk.config;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.PasswordPolicy;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
public class PlatformAdminBootstrap implements ApplicationRunner {

    private static final long BOOTSTRAP_ADVISORY_LOCK_KEY = 0x44574B5F504C4154L;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserRepository userRepository;
    private final PlatformAdminRepository platformAdminRepository;
    private final PasswordEncoder passwordEncoder;
    private final DirectwerkProperties.Bootstrap config;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Creates a platform admin bootstrap component from the application configuration.
     *
     * @param properties application properties containing the platform admin bootstrap settings
     */
    @Autowired
    public PlatformAdminBootstrap(
            UserRepository userRepository,
            PlatformAdminRepository platformAdminRepository,
            PasswordEncoder passwordEncoder,
            DirectwerkProperties properties
    ) {
        this(userRepository, platformAdminRepository, passwordEncoder, properties.bootstrap());
    }

    /**
     * Creates a bootstrap component with the repositories, password encoder, and bootstrap configuration it uses.
     *
     * @param userRepository the repository for user persistence
     * @param platformAdminRepository the repository for platform administrator persistence
     * @param passwordEncoder the encoder used for administrator passwords
     * @param config the platform administrator bootstrap configuration
     */
    PlatformAdminBootstrap(
            UserRepository userRepository,
            PlatformAdminRepository platformAdminRepository,
            PasswordEncoder passwordEncoder,
            DirectwerkProperties.Bootstrap config
    ) {
        this.userRepository = userRepository;
        this.platformAdminRepository = platformAdminRepository;
        this.passwordEncoder = passwordEncoder;
        this.config = config;
    }

    /**
     * Bootstraps the configured platform administrator when no platform administrator exists.
     *
     * <p>Both an email address and password are required when bootstrap configuration is provided.
     * The email is normalized and validated, and the password must satisfy {@link PasswordPolicy}.
     * An existing user is updated or a new user is created, then linked to a new
     * platform administrator.</p>
     *
     * @throws IllegalStateException if only one credential is configured, the email is invalid,
     *                               or the password is invalid
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String email = config == null ? null : config.platformAdminEmail();
        String password = config == null ? null : config.platformAdminPassword();
        if (!StringUtils.hasText(email) && !StringUtils.hasText(password)) {
            return;
        }
        if (!StringUtils.hasText(email) || !StringUtils.hasText(password)) {
            throw new IllegalStateException("Bootstrap platform admin requires both email and password");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (normalizedEmail.length() > 255 || !EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new IllegalStateException("Bootstrap platform admin email is invalid");
        }
        try {
            PasswordPolicy.validate(password);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Bootstrap platform admin password must be between 8 and 128 characters");
        }

        acquireBootstrapLock();
        if (platformAdminRepository.count() != 0) {
            return;
        }

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(User::new);
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.save(user);

        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);
        try {
            platformAdminRepository.save(admin);
        } catch (DataIntegrityViolationException ex) {
            if (platformAdminRepository.count() == 0) {
                throw ex;
            }
        }
    }

    private void acquireBootstrapLock() {
        if (entityManager == null) {
            return;
        }
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(?)")
                .setParameter(1, BOOTSTRAP_ADVISORY_LOCK_KEY)
                .getSingleResult();
    }
}
