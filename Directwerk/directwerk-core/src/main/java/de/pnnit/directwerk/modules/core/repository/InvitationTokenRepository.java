package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.InvitationToken;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvitationTokenRepository extends JpaRepository<InvitationToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<InvitationToken> findByTokenHash(String tokenHash);

    @Query("""
            select token from InvitationToken token
            where token.user.id = :userId
              and token.type = :type
              and token.usedAt is null
              and token.expiresAt > CURRENT_TIMESTAMP
            """)
    List<InvitationToken> findActiveByUserIdAndType(
            @Param("userId") Long userId,
            @Param("type") InvitationType type
    );
}
