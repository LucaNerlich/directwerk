package de.pnnit.directwerk.modules.core.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class StudioNavigationService {

    private static final String ARTICLES_MODULE_KEY = "ARTICLES";
    private static final String PODCAST_MODULE_KEY = "PODCAST";
    private static final String WHITELABEL_MODULE_KEY = "WHITELABEL";

    public StudioNavigationView resolve(Collection<String> enabledModules) {
        Set<String> modules = Set.copyOf(enabledModules);
        List<StudioDesk> desks = new ArrayList<>(2);
        if (modules.contains(ARTICLES_MODULE_KEY)) {
            desks.add(StudioDesk.WRITE);
        }
        if (modules.contains(PODCAST_MODULE_KEY)) {
            desks.add(StudioDesk.PODCAST);
        }
        return new StudioNavigationView(desks, resolveHome(modules, desks));
    }

    private static StudioHome resolveHome(Set<String> modules, List<StudioDesk> desks) {
        if (desks.size() > 1 && modules.contains(WHITELABEL_MODULE_KEY)) {
            return StudioHome.OVERVIEW;
        }
        if (desks.contains(StudioDesk.PODCAST)) {
            return StudioHome.PODCAST_DESK;
        }
        if (desks.contains(StudioDesk.WRITE)) {
            return StudioHome.WRITE_DESK;
        }
        return StudioHome.OVERVIEW;
    }

    public record StudioNavigationView(List<StudioDesk> desks, StudioHome home) {
    }
}
