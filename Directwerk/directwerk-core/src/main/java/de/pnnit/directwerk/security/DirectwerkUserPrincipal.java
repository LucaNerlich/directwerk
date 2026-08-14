package de.pnnit.directwerk.security;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.User;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

// UserDetails' getPassword()/getUsername()/isEnabled()/etc. read like extra bean properties to
// Jackson alongside the record's own components; ignore them so OAuth2Authorization JSON
// persistence round-trips only the record's canonical fields. passwordHash is excluded too since
// nothing reads it back off a stored/deserialized principal — credentials are always re-verified
// via UserDetailsService — so there's no reason to persist it in the authorization store at rest.
@JsonIgnoreProperties({
        "password", "username", "enabled", "accountNonExpired", "accountNonLocked", "credentialsNonExpired",
        "passwordHash"
})
public record DirectwerkUserPrincipal(
        Long userId,
        String email,
        String passwordHash,
        Long tenantId,
        Collection<? extends GrantedAuthority> authorities
) implements UserDetails {

    public DirectwerkUserPrincipal {
        // Normalize to ArrayList: Spring Security's Jackson PolymorphicTypeValidator trusts common
        // JDK collection types like ArrayList, but not the internal immutable list classes returned
        // by List.of(...)/Stream.toList(), which would otherwise fail OAuth2Authorization JSON
        // deserialization.
        authorities = new ArrayList<>(authorities);
    }

    static DirectwerkUserPrincipal platformAdmin(User user) {
        return new DirectwerkUserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.PLATFORM_ADMIN))
        );
    }

    static DirectwerkUserPrincipal tenantUser(User user, Long tenantId, Set<Role> roles) {
        List<SimpleGrantedAuthority> authorities = roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
        return new DirectwerkUserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                tenantId,
                authorities
        );
    }

    public List<String> roleNames() {
        return authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .map(authority -> authority.replace("ROLE_", ""))
                .toList();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
