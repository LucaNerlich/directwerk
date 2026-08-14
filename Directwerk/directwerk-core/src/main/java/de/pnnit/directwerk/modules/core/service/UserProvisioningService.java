package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class UserProvisioningService {

    private final UserRepository userRepository;

    public User findOrCreatePendingUser(String email, String name) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        return userRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(() -> {
            try {
                return createPendingUserInNewTransaction(normalizedEmail, name);
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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    User createPendingUserInNewTransaction(String normalizedEmail, String name) {
        User created = new User();
        created.setEmail(normalizedEmail);
        created.setName(name);
        created.setStatus(UserStatus.PENDING_VERIFICATION);
        return userRepository.save(created);
    }
}
