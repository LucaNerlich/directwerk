package de.pnnit.directwerk.modules.email.quartz;

import de.pnnit.directwerk.modules.email.EmailDeliveryCleanupService;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

/**
 * Quartz constructs each instance; Spring Boot's {@code SpringBeanJobFactory} autowires it
 * (not a Spring singleton — do not add {@code @Component}).
 */
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class EmailDeliveryCleanupJob extends QuartzJobBean {

    private EmailDeliveryCleanupService emailDeliveryCleanupService;

    @Autowired
    public void setEmailDeliveryCleanupService(EmailDeliveryCleanupService emailDeliveryCleanupService) {
        this.emailDeliveryCleanupService = emailDeliveryCleanupService;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) {
        emailDeliveryCleanupService.cleanup();
    }
}
