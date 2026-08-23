package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class UserProvisioningService {

    private final UserRepository userRepository;

    /**
     * Self-proxy used to invoke {@link #createPendingUserInNewTransaction}
     * through the Spring AOP proxy. Calling the method directly on {@code this}
     * would bypass the proxy and silently drop its REQUIRES_NEW semantics.
     */
    private final ObjectProvider<UserProvisioningService> selfProvider;

    public User findOrCreatePendingUser(String email, String name) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        return userRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(() -> {
            try {
                return selfProvider.getObject()
                        .createPendingUserInNewTransaction(normalizedEmail, name);
            } catch (DataIntegrityViolationException ex) {
                return userRepository.findByEmailIgnoreCase(normalizedEmail)
                        .orElseThrow(() -> ex);
            }
        });
    }

    public User findOrCreatePendingUser(String email, String name, boolean refreshPendingProfile) {
        User user = findOrCreatePendingUser(email, name);
        if (refreshPendingProfile && user.getStatus() == UserStatus.PENDING_VERIFICATION) {
            if (StringUtils.hasText(name)) {
                user.setName(name.trim());
            }
            userRepository.save(user);
        }
        return user;
    }

    /**
     * Inserts the pending user in its own committed transaction so that a
     * concurrent insert of the same email only fails this insert — the outer
     * transaction (e.g. an invitation) stays usable and the caller can recover
     * by re-reading the existing user. Must be invoked through the Spring proxy
     * (see {@code selfProvider}) for REQUIRES_NEW to take effect.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public User createPendingUserInNewTransaction(String normalizedEmail, String name) {
        User created = new User();
        created.setEmail(normalizedEmail);
        created.setName(name);
        created.setStatus(UserStatus.PENDING_VERIFICATION);
        return userRepository.save(created);
    }
}
