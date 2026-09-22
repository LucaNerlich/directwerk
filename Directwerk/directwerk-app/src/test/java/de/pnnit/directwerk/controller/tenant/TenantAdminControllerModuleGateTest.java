package de.pnnit.directwerk.controller.tenant;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.RequiresModule;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

class TenantAdminControllerModuleGateTest {

    @Test
    void updateBrandingRequiresWhitelabelModule() throws NoSuchMethodException {
        Method method = TenantAdminController.class.getDeclaredMethod(
                "updateBranding", TenantAdminController.BrandingUpdateRequest.class);

        RequiresModule requiresModule = method.getAnnotation(RequiresModule.class);

        assertThat(requiresModule).isNotNull();
        assertThat(requiresModule.value()).containsExactly("WHITELABEL");
    }
}
