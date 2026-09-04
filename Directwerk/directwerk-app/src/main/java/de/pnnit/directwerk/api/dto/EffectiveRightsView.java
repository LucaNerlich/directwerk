package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.EffectiveAccess;
import java.util.List;
import java.util.Map;

public record EffectiveRightsView(
        Long userId,
        List<String> roles,
        List<PermissionRestrictionView> restrictions,
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> effective
) {
}
