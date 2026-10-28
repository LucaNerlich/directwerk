-- Public podcast-directory contact for RSS/iTunes owner tags (tenant-specific).
ALTER TABLE tenants
    ADD COLUMN contact_email VARCHAR(255);
