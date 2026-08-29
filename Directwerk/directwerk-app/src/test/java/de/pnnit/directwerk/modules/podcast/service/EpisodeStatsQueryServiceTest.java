package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EpisodeStatsQueryServiceTest {

    @Mock
    private EpisodeRepository episodeRepository;

    @InjectMocks
    private EpisodeStatsQueryService service;

    @Test
    void countEpisodesDelegatesToRepository() {
        when(episodeRepository.countByTenantId(9L)).thenReturn(42L);

        assertThat(service.countEpisodes(9L)).isEqualTo(42L);
    }
}
