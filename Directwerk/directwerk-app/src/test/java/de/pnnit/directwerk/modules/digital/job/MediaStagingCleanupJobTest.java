package de.pnnit.directwerk.modules.digital.job;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.job.StagingCleanupService;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Trigger;
import org.quartz.TriggerKey;

@ExtendWith(MockitoExtension.class)
class MediaStagingCleanupJobTest {

    @Mock
    private StagingCleanupService stagingCleanupService;

    @Mock
    private JobExecutionContext context;

    @Mock
    private JobDetail jobDetail;

    @Mock
    private Trigger trigger;

    @Test
    void delegatesToCleanupService() {
        MediaStagingCleanupJob job = new MediaStagingCleanupJob();
        job.setStagingCleanupService(stagingCleanupService);

        job.executeInternal(context);

        verify(stagingCleanupService).cleanupExpiredStaging();
    }

    @Test
    void swallowsCleanupFailures() {
        doThrow(new RuntimeException("boom")).when(stagingCleanupService).cleanupExpiredStaging();
        when(context.getJobDetail()).thenReturn(jobDetail);
        when(jobDetail.getKey()).thenReturn(JobKey.jobKey("mediaStagingCleanupJob"));
        when(context.getTrigger()).thenReturn(trigger);
        when(trigger.getKey()).thenReturn(TriggerKey.triggerKey("mediaStagingCleanupTrigger"));
        when(context.getFireTime()).thenReturn(Date.from(Instant.now()));

        MediaStagingCleanupJob job = new MediaStagingCleanupJob();
        job.setStagingCleanupService(stagingCleanupService);

        job.executeInternal(context);

        verify(stagingCleanupService).cleanupExpiredStaging();
    }
}
