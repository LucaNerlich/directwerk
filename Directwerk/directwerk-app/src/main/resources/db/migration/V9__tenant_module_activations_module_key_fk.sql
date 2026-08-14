DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = current_schema()
          AND rel.relname = 'tenant_module_activations'
          AND c.contype = 'f'
          AND c.conname = 'fk_tenant_module_activations_module_key'
          AND pg_get_constraintdef(c.oid) LIKE '%FOREIGN KEY (module_key)%REFERENCES feature_modules(module_key)%'
    ) THEN
        ALTER TABLE tenant_module_activations
            ADD CONSTRAINT fk_tenant_module_activations_module_key
                FOREIGN KEY (module_key) REFERENCES feature_modules(module_key)
                ON DELETE RESTRICT;
    END IF;
END $$;
