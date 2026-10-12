-- Migration 008: Immutability & Append-Only Database Triggers

-- 1. Trigger function for append-only tables (rejects UPDATE and DELETE)
CREATE OR REPLACE FUNCTION prevent_table_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is strictly append-only. UPDATE and DELETE operations are prohibited.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Apply append-only trigger to audit_log
DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_table_update_or_delete();

-- Apply append-only trigger to attempt_events
DROP TRIGGER IF EXISTS trg_attempt_events_append_only ON attempt_events;
CREATE TRIGGER trg_attempt_events_append_only
  BEFORE UPDATE OR DELETE ON attempt_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_table_update_or_delete();

-- Apply append-only trigger to usage_events
DROP TRIGGER IF EXISTS trg_usage_events_append_only ON usage_events;
CREATE TRIGGER trg_usage_events_append_only
  BEFORE UPDATE OR DELETE ON usage_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_table_update_or_delete();


-- 2. Trigger function for published version immutability (locks published versions, allows retiring without content edits)
CREATE OR REPLACE FUNCTION prevent_published_version_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' THEN
    IF TG_TABLE_NAME = 'question_versions' THEN
      -- Allow retiring a leaked/deprecated version if content is unchanged
      IF NEW.status = 'retired' AND NEW.title = OLD.title AND NEW.description = OLD.description AND NEW.content = OLD.content THEN
        RETURN NEW;
      END IF;
    ELSIF TG_TABLE_NAME = 'assessment_versions' THEN
      -- Allow archiving an assessment version if content/settings are unchanged
      IF NEW.status = 'archived' AND NEW.title = OLD.title AND NEW.description = OLD.description THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'Published version % is immutable and cannot be updated. Create a new version.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply immutability trigger to question_versions
DROP TRIGGER IF EXISTS trg_question_versions_immutable ON question_versions;
CREATE TRIGGER trg_question_versions_immutable
  BEFORE UPDATE ON question_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_version_update();

-- Apply immutability trigger to assessment_versions
DROP TRIGGER IF EXISTS trg_assessment_versions_immutable ON assessment_versions;
CREATE TRIGGER trg_assessment_versions_immutable
  BEFORE UPDATE ON assessment_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_version_update();
