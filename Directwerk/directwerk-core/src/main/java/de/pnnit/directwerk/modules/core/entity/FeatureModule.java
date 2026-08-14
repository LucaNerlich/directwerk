package de.pnnit.directwerk.modules.core.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "feature_modules")
@Getter
@Setter
public class FeatureModule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "module_key", nullable = false, unique = true, length = 64)
    private String moduleKey;

    @Column(nullable = false, length = 128)
    private String name;

    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "depends_on", nullable = false, columnDefinition = "jsonb")
    private List<String> dependsOn = new ArrayList<>();

    @Column(name = "is_core", nullable = false)
    private boolean core;

    @Column(name = "platform_active", nullable = false)
    private boolean platformActive = true;
}
