-- =============================================================================
-- AEMS v2 — MySQL 8 (Amazon RDS) schema + base seed data
-- Run once on a fresh database:
--   mysql -h <rds-endpoint> -u <user> -p <db_name> < aws/mysql_schema.sql
-- All timestamps are stored in UTC.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- 1. Organisation structure
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(100) NOT NULL,
  address     TEXT         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_locations_name (name),
  UNIQUE KEY uq_locations_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS plants (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  location_id      CHAR(36)     NOT NULL,
  name             VARCHAR(255) NOT NULL,
  code             VARCHAR(100) NOT NULL,
  sub_departments  JSON         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_plants_location_code (location_id, code),
  CONSTRAINT fk_plants_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id              CHAR(36)     NOT NULL DEFAULT (UUID()),
  email           VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(50)  NULL,
  emp_code        VARCHAR(100) NULL,
  role            ENUM('it_admin','admin','hr','user') NOT NULL DEFAULT 'user',
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  location_id     CHAR(36)     NULL,
  plant_id        CHAR(36)     NULL,
  department_id   CHAR(36)     NULL,
  sub_department  VARCHAR(255) NULL,
  last_login_at   DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS departments (
  id              CHAR(36)     NOT NULL DEFAULT (UUID()),
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(100) NOT NULL,
  plant_id        CHAR(36)     NULL,
  sub_department  VARCHAR(255) NULL,
  admin_user_id   CHAR(36)     NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code),
  KEY idx_departments_plant (plant_id),
  CONSTRAINT fk_departments_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE SET NULL,
  CONSTRAINT fk_departments_admin_user FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_scopes (
  id              CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id         CHAR(36)     NOT NULL,
  can_edit        TINYINT(1)   NOT NULL DEFAULT 1,
  category_ids    JSON         NULL,
  location_ids    JSON         NULL,
  plant_ids       JSON         NULL,
  department_ids  JSON         NULL,
  sub_department  VARCHAR(255) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_scopes_user (user_id),
  CONSTRAINT fk_user_scopes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS auth_otps (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  email       VARCHAR(255) NOT NULL,
  otp_hash    VARCHAR(128) NOT NULL,
  attempts    INT          NOT NULL DEFAULT 0,
  is_used     TINYINT(1)   NOT NULL DEFAULT 0,
  expires_at  DATETIME(3)  NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_auth_otps_email (email, is_used, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id             CHAR(36)     NOT NULL,
  session_token_hash  VARCHAR(128) NOT NULL,
  device_info         TEXT         NULL,
  ip_address          VARCHAR(100) NULL,
  last_activity_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at          DATETIME(3)  NOT NULL,
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_sessions_token (session_token_hash),
  KEY idx_user_sessions_user (user_id, is_active),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 2. Categories & dynamic form fields
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  name         VARCHAR(255) NOT NULL,
  code         VARCHAR(100) NOT NULL,
  description  TEXT         NULL,
  icon         VARCHAR(100) NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS category_form_fields (
  id             CHAR(36)     NOT NULL DEFAULT (UUID()),
  category_id    CHAR(36)     NOT NULL,
  field_name     VARCHAR(150) NOT NULL,
  field_label    VARCHAR(255) NOT NULL,
  field_type     ENUM('text','number','date','select','boolean','textarea') NOT NULL DEFAULT 'text',
  options        JSON         NULL,
  is_required    TINYINT(1)   NOT NULL DEFAULT 0,
  placeholder    VARCHAR(255) NULL,
  display_order  INT          NOT NULL DEFAULT 0,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cat_fields_name (category_id, field_name),
  KEY idx_cat_fields_order (category_id, display_order),
  CONSTRAINT fk_cat_fields_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 3. Employees
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employees (
  id             CHAR(36)     NOT NULL DEFAULT (UUID()),
  emp_code       VARCHAR(100) NOT NULL,
  full_name      VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NULL,
  phone          VARCHAR(50)  NULL,
  designation    VARCHAR(255) NULL,
  department_id  CHAR(36)     NOT NULL,
  plant_id       CHAR(36)     NOT NULL,
  location_id    CHAR(36)     NOT NULL,
  status         ENUM('active','resigned','on_leave') NOT NULL DEFAULT 'active',
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_code (emp_code),
  KEY idx_employees_dept (department_id),
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employees_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employees_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 4. Assets, custom values, peripherals, custody ledger
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assets (
  id                     CHAR(36)      NOT NULL DEFAULT (UUID()),
  asset_tag              VARCHAR(150)  NOT NULL,
  serial_number          VARCHAR(255)  NULL,
  name                   VARCHAR(255)  NOT NULL,
  model                  VARCHAR(255)  NULL,
  manufacturer           VARCHAR(255)  NULL,
  hostname               VARCHAR(255)  NULL,
  category_id            CHAR(36)      NOT NULL,
  purchase_date          DATE          NULL,
  purchase_cost          DECIMAL(12,2) NULL,
  po_number              VARCHAR(255)  NULL,
  vendor_name            VARCHAR(255)  NULL,
  warranty_expiry        DATE          NULL,
  amc_vendor             VARCHAR(255)  NULL,
  amc_expiry             DATE          NULL,
  invoice_document_path  LONGTEXT      NULL,
  current_location_id    CHAR(36)      NOT NULL,
  current_plant_id       CHAR(36)      NOT NULL,
  current_department_id  CHAR(36)      NOT NULL,
  assigned_employee_id   CHAR(36)      NULL,
  status                 ENUM('in_service','maintenance','damaged','missing','scrapped','in_storage') NOT NULL DEFAULT 'in_service',
  is_deleted             TINYINT(1)    NOT NULL DEFAULT 0,
  deleted_at             DATETIME(3)   NULL,
  deleted_by             CHAR(36)      NULL,
  created_by             CHAR(36)      NULL,
  created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_assets_tag (asset_tag),
  KEY idx_assets_serial (serial_number),
  KEY idx_assets_category (category_id),
  KEY idx_assets_location (current_location_id),
  KEY idx_assets_plant (current_plant_id),
  KEY idx_assets_department (current_department_id),
  KEY idx_assets_employee (assigned_employee_id),
  KEY idx_assets_status (status, is_deleted),
  CONSTRAINT fk_assets_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assets_location FOREIGN KEY (current_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assets_plant FOREIGN KEY (current_plant_id) REFERENCES plants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assets_department FOREIGN KEY (current_department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assets_employee FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_assets_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_assets_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS asset_custom_values (
  id           CHAR(36)    NOT NULL DEFAULT (UUID()),
  asset_id     CHAR(36)    NOT NULL,
  field_id     CHAR(36)    NOT NULL,
  field_value  TEXT        NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_asset_custom_values (asset_id, field_id),
  CONSTRAINT fk_acv_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_acv_field FOREIGN KEY (field_id) REFERENCES category_form_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS asset_peripherals (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  asset_id         CHAR(36)     NOT NULL,
  peripheral_name  VARCHAR(255) NOT NULL,
  model_number     VARCHAR(255) NULL,
  serial_number    VARCHAR(255) NULL,
  is_included      TINYINT(1)   NOT NULL DEFAULT 1,
  notes            TEXT         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_asset_peripherals_asset (asset_id),
  CONSTRAINT fk_peripherals_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS asset_assignments (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  asset_id          CHAR(36)     NOT NULL,
  employee_id       CHAR(36)     NOT NULL,
  assigned_by       CHAR(36)     NULL,
  assigned_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  returned_at       DATETIME(3)  NULL,
  return_condition  VARCHAR(255) NULL,
  remarks           TEXT         NULL,
  PRIMARY KEY (id),
  KEY idx_asset_assignments_asset (asset_id, returned_at),
  KEY idx_asset_assignments_emp (employee_id),
  CONSTRAINT fk_assignments_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS asset_transfers (
  id                  CHAR(36)    NOT NULL DEFAULT (UUID()),
  asset_id            CHAR(36)    NOT NULL,
  from_department_id  CHAR(36)    NULL,
  to_department_id    CHAR(36)    NOT NULL,
  from_location_id    CHAR(36)    NULL,
  to_location_id      CHAR(36)    NOT NULL,
  from_plant_id       CHAR(36)    NULL,
  to_plant_id         CHAR(36)    NOT NULL,
  transferred_by      CHAR(36)    NULL,
  reason              TEXT        NULL,
  transferred_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_asset_transfers_asset (asset_id),
  CONSTRAINT fk_transfers_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_transfers_from_dept FOREIGN KEY (from_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_transfers_to_dept FOREIGN KEY (to_department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transfers_from_loc FOREIGN KEY (from_location_id) REFERENCES locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_transfers_to_loc FOREIGN KEY (to_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transfers_from_plant FOREIGN KEY (from_plant_id) REFERENCES plants(id) ON DELETE SET NULL,
  CONSTRAINT fk_transfers_to_plant FOREIGN KEY (to_plant_id) REFERENCES plants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transfers_by FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 5. Damaged / missing / scrap reports
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS damage_scrap_reports (
  id                 CHAR(36)     NOT NULL DEFAULT (UUID()),
  asset_id           CHAR(36)     NOT NULL,
  report_type        ENUM('damaged','missing','scrap') NOT NULL,
  reason             TEXT         NOT NULL,
  severity           ENUM('minor','major','total_loss') NOT NULL DEFAULT 'minor',
  photo_paths        JSON         NULL,
  document_url       LONGTEXT     NULL,
  employee_id        VARCHAR(100) NULL,
  employee_name      VARCHAR(255) NULL,
  employee_email     VARCHAR(255) NULL,
  contact_phone      VARCHAR(50)  NULL,
  reported_by        CHAR(36)     NOT NULL,
  status             ENUM('pending','approved','rejected','resolved') NOT NULL DEFAULT 'pending',
  resolution_status  VARCHAR(50)  NULL DEFAULT 'pending',
  resolution_action  VARCHAR(100) NULL,
  resolution_notes   TEXT         NULL,
  reviewer_id        CHAR(36)     NULL,
  review_remarks     TEXT         NULL,
  reviewed_at        DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_damage_reports_asset (asset_id),
  KEY idx_damage_reports_status (status),
  CONSTRAINT fk_damage_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_damage_reporter FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_damage_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 6. Preventive maintenance & public QR complaints
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pm_machines (
  id                 CHAR(36)     NOT NULL DEFAULT (UUID()),
  asset_id           CHAR(36)     NULL,
  machine_code       VARCHAR(150) NOT NULL,
  machine_name       VARCHAR(255) NOT NULL,
  plant_id           CHAR(36)     NOT NULL,
  location_id        CHAR(36)     NOT NULL,
  department_id      CHAR(36)     NOT NULL,
  pm_frequency_days  INT          NOT NULL DEFAULT 30,
  last_pm_date       DATE         NULL,
  next_pm_date       DATE         NOT NULL,
  qr_code_token      VARCHAR(100) NOT NULL DEFAULT (REPLACE(UUID(), '-', '')),
  status             ENUM('operational','under_maintenance','breakdown') NOT NULL DEFAULT 'operational',
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pm_machines_code (machine_code),
  UNIQUE KEY uq_pm_machines_token (qr_code_token),
  KEY idx_pm_machines_next_due (next_pm_date),
  CONSTRAINT fk_pm_machines_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  CONSTRAINT fk_pm_machines_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pm_machines_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pm_machines_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pm_schedules (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()),
  machine_id      CHAR(36)    NOT NULL,
  due_date        DATE        NOT NULL,
  completed_date  DATE        NULL,
  status          ENUM('scheduled','in_progress','completed','overdue','cancelled') NOT NULL DEFAULT 'scheduled',
  assigned_to     CHAR(36)    NULL,
  checklist_data  JSON        NULL,
  notes           TEXT        NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_pm_schedules_machine (machine_id),
  KEY idx_pm_schedules_due (due_date, status),
  CONSTRAINT fk_pm_schedules_machine FOREIGN KEY (machine_id) REFERENCES pm_machines(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_schedules_user FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pm_complaints (
  id                 CHAR(36)      NOT NULL DEFAULT (UUID()),
  machine_id         CHAR(36)      NOT NULL,
  reporter_name      VARCHAR(255)  NOT NULL,
  reporter_contact   VARCHAR(255)  NULL,
  description        TEXT          NOT NULL,
  priority           ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status             ENUM('open','assigned','in_progress','resolved','rejected') NOT NULL DEFAULT 'open',
  resolution_notes   TEXT          NULL,
  technician_cost    DECIMAL(10,2) NULL,
  replacement_parts  TEXT          NULL,
  resolved_by        CHAR(36)      NULL,
  resolved_at        DATETIME(3)   NULL,
  ip_address         VARCHAR(100)  NULL,
  created_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_pm_complaints_machine (machine_id),
  KEY idx_pm_complaints_status (status),
  KEY idx_pm_complaints_ip_created (ip_address, created_at),
  CONSTRAINT fk_pm_complaints_machine FOREIGN KEY (machine_id) REFERENCES pm_machines(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_complaints_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 7. Audit logs (no FK on user_id so logs survive user deletion)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  event_category    VARCHAR(50)  NOT NULL,
  user_id           CHAR(36)     NULL,
  user_role         VARCHAR(50)  NOT NULL DEFAULT 'anonymous',
  action            VARCHAR(255) NOT NULL,
  target_table      VARCHAR(100) NULL,
  record_id         VARCHAR(255) NULL,
  changes           JSON         NULL,
  risk_level        ENUM('normal','warning','critical') NOT NULL DEFAULT 'normal',
  ip_address        VARCHAR(100) NULL,
  user_agent        TEXT         NULL,
  location_id       CHAR(36)     NULL,
  plant_id          CHAR(36)     NULL,
  department_id     CHAR(36)     NULL,
  location_name     VARCHAR(255) NULL,
  plant_name        VARCHAR(255) NULL,
  department_name   VARCHAR(255) NULL,
  emp_code          VARCHAR(100) NULL,
  session_duration  VARCHAR(100) NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_event_cat (event_category, created_at),
  KEY idx_audit_logs_risk (risk_level, created_at),
  KEY idx_audit_logs_ip (ip_address, created_at),
  KEY idx_audit_logs_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 8. Email templates
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_templates (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  template_key  VARCHAR(150) NOT NULL,
  subject       VARCHAR(500) NOT NULL,
  body_html     TEXT         NOT NULL,
  description   TEXT         NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_templates_key (template_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 9. Smart Mail campaigns (Settings > Smart Mail). Also auto-created at runtime.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS smart_mail_campaigns (
  id                  CHAR(36)     NOT NULL,
  title               VARCHAR(255) NOT NULL,
  subject             VARCHAR(500) NOT NULL,
  body_html           MEDIUMTEXT   NOT NULL,
  recipients          TEXT         NULL,
  include_employees   TINYINT(1)   NOT NULL DEFAULT 0,
  target_location_id  CHAR(36)     NULL,
  target_plant_id     CHAR(36)     NULL,
  schedule_at         DATETIME(3)  NULL,
  repeat_mode         VARCHAR(20)  NOT NULL DEFAULT 'once',
  status              VARCHAR(20)  NOT NULL DEFAULT 'draft',
  last_sent_at        DATETIME(3)  NULL,
  last_result         TEXT         NULL,
  created_by          CHAR(36)     NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_smart_mail_due (status, schedule_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 10. Plant Head approvals for a second asset of the same type. Also auto-created at runtime.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS asset_approval_requests (
  id                  CHAR(36)     NOT NULL,
  token               VARCHAR(64)  NOT NULL,
  asset_id            CHAR(36)     NULL,
  asset_label         VARCHAR(500) NULL,
  employee_id         CHAR(36)     NOT NULL,
  employee_label      VARCHAR(255) NULL,
  category_id         CHAR(36)     NOT NULL,
  category_name       VARCHAR(255) NOT NULL,
  existing_assets     TEXT         NULL,
  to_emails           TEXT         NOT NULL,
  cc_emails           TEXT         NULL,
  request_remarks     TEXT         NULL,
  requested_by        CHAR(36)     NULL,
  requested_by_label  VARCHAR(255) NULL,
  requested_by_email  VARCHAR(255) NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
  decided_by_name     VARCHAR(255) NULL,
  decision_remarks    TEXT         NULL,
  decided_at          DATETIME(3)  NULL,
  used_at             DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_asset_approval_token (token),
  KEY idx_asset_approval_employee (employee_id, category_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT IGNORE INTO locations (id, name, code, address) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Pune', 'LOC-PUNE', 'Pune, Maharashtra');

INSERT IGNORE INTO plants (id, location_id, name, code) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'NGM', 'NGM'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'PGTL', 'PGTL'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'PGEL', 'PGEL');

INSERT IGNORE INTO users (id, email, full_name, phone, role, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'software.2040@pgel.in', 'Software Team (IT Admin)', NULL, 'it_admin', 1);

INSERT IGNORE INTO user_scopes (user_id, can_edit, category_ids, location_ids, plant_ids) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, NULL, NULL, NULL);

INSERT IGNORE INTO departments (id, name, code, admin_user_id) VALUES
  ('33333333-3333-3333-3333-333333333301', 'Information Technology', 'DEPT-IT', '00000000-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333302', 'Production & Assembly', 'DEPT-PROD', '00000000-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333303', 'Quality Assurance', 'DEPT-QA', '00000000-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333304', 'Human Resources', 'DEPT-HR', '00000000-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333305', 'Plant Maintenance & Electrical', 'DEPT-MAINT', '00000000-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333306', 'Health, Safety & Environment', 'DEPT-HSE', '00000000-0000-0000-0000-000000000001');

INSERT IGNORE INTO categories (id, name, code, description, icon) VALUES
  ('44444444-4444-4444-4444-444444444401', 'IT', 'CAT-IT', 'Laptops, Desktops, Servers, Switches, Printers', 'Laptop'),
  ('44444444-4444-4444-4444-444444444402', 'Camera/NVR', 'CAT-SEC', 'CCTV Cameras, NVR, DVR, Biometric Scanners', 'Video'),
  ('44444444-4444-4444-4444-444444444403', 'Quality', 'CAT-QA', 'Calibrated Gauges, Testing Jigs, Spectrometers', 'ShieldCheck'),
  ('44444444-4444-4444-4444-444444444404', 'Electrical', 'CAT-ELEC', 'Transformers, VFDs, Control Panels, DG Sets', 'Zap'),
  ('44444444-4444-4444-4444-444444444405', 'Production', 'CAT-PROD', 'Molding Machines, Conveyors, SMT Lines, Compressors', 'Cog'),
  ('44444444-4444-4444-4444-444444444406', 'Safety', 'CAT-SAFE', 'Fire Extinguishers, Hydrant Systems, PPE Stations', 'Flame'),
  ('44444444-4444-4444-4444-444444444407', 'Vehicle', 'CAT-VEH', 'Forklifts, Stackers, Trucks, Company Vehicles', 'Truck'),
  ('44444444-4444-4444-4444-444444444408', 'Furniture', 'CAT-FURN', 'Workstations, Conference Tables, Ergonomic Chairs', 'Armchair'),
  ('44444444-4444-4444-4444-444444444409', 'Software License', 'CAT-SW', 'CAD/CAM Licenses, ERP Seats, OS Licences', 'Key'),
  ('44444444-4444-4444-4444-444444444410', 'Maintenance', 'CAT-MAINT', 'Welding Machines, Hydraulic Presses, Toolkits', 'Wrench');

INSERT IGNORE INTO category_form_fields (category_id, field_name, field_label, field_type, options, is_required, display_order, placeholder) VALUES
  ('44444444-4444-4444-4444-444444444401', 'ram_size', 'RAM Size', 'select', JSON_ARRAY('8 GB', '16 GB', '32 GB', '64 GB', '128 GB'), 1, 1, 'Select RAM'),
  ('44444444-4444-4444-4444-444444444401', 'storage_capacity', 'Storage Capacity', 'select', JSON_ARRAY('256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD', '1 TB HDD'), 1, 2, 'Select Storage'),
  ('44444444-4444-4444-4444-444444444401', 'operating_system', 'Operating System', 'select', JSON_ARRAY('Windows 11 Pro', 'Windows 10 Pro', 'Ubuntu Linux', 'macOS Sonoma'), 1, 3, 'Select OS'),
  ('44444444-4444-4444-4444-444444444401', 'processor', 'Processor Model', 'text', NULL, 0, 4, 'e.g. Intel Core i7-13700H / AMD Ryzen 7'),
  ('44444444-4444-4444-4444-444444444401', 'ip_address', 'Assigned Static IP', 'text', NULL, 0, 5, 'e.g. 192.168.10.45'),
  ('44444444-4444-4444-4444-444444444402', 'camera_resolution', 'Camera Resolution', 'select', JSON_ARRAY('2 MP (1080p)', '4 MP (2K)', '8 MP (4K)', 'PTZ High Zoom'), 1, 1, 'Resolution'),
  ('44444444-4444-4444-4444-444444444402', 'nvr_channels', 'NVR Supported Channels', 'select', JSON_ARRAY('8 Channel', '16 Channel', '32 Channel', '64 Channel'), 0, 2, 'Channels'),
  ('44444444-4444-4444-4444-444444444402', 'ip_address', 'IP Address / RTSP Link', 'text', NULL, 0, 3, '192.168.20.xxx'),
  ('44444444-4444-4444-4444-444444444403', 'last_calibration_date', 'Last Calibration Date', 'date', NULL, 1, 1, 'YYYY-MM-DD'),
  ('44444444-4444-4444-4444-444444444403', 'calibration_due_date', 'Calibration Due Date', 'date', NULL, 1, 2, 'YYYY-MM-DD'),
  ('44444444-4444-4444-4444-444444444403', 'accuracy_tolerance', 'Accuracy Tolerance', 'text', NULL, 0, 3, 'e.g. +/- 0.01 mm'),
  ('44444444-4444-4444-4444-444444444404', 'rated_voltage', 'Rated Voltage (V)', 'select', JSON_ARRAY('220V Single Phase', '415V 3-Phase', '11kV High Tension'), 1, 1, 'Voltage'),
  ('44444444-4444-4444-4444-444444444404', 'power_rating', 'Power Rating (kW / kVA)', 'text', NULL, 1, 2, 'e.g. 75 kW'),
  ('44444444-4444-4444-4444-444444444405', 'tonnage_capacity', 'Tonnage Capacity (Tons)', 'number', NULL, 0, 1, 'e.g. 350'),
  ('44444444-4444-4444-4444-444444444405', 'injection_volume', 'Shot Weight / Volume (g)', 'number', NULL, 0, 2, 'e.g. 520'),
  ('44444444-4444-4444-4444-444444444407', 'reg_number', 'Vehicle Registration No.', 'text', NULL, 1, 1, 'e.g. UP 16 AB 1234'),
  ('44444444-4444-4444-4444-444444444407', 'chassis_number', 'Chassis / Engine Number', 'text', NULL, 0, 2, 'Chassis Number'),
  ('44444444-4444-4444-4444-444444444407', 'insurance_expiry', 'Insurance Expiry Date', 'date', NULL, 1, 3, 'Insurance Due Date');

INSERT IGNORE INTO email_templates (template_key, subject, body_html, description) VALUES
  ('pm_overdue_alert', 'URGENT: Machine Maintenance Overdue — {{machine_code}} ({{machine_name}})', '<p>Dear Team,</p><p>Machine <strong>{{machine_name}}</strong> (Code: <code>{{machine_code}}</code>) at <strong>{{plant_name}}</strong> has exceeded its scheduled PM due date of <strong>{{due_date}}</strong>.</p><p>Please assign a maintenance technician immediately.</p>', 'Triggered when PM schedule is past due date'),
  ('asset_transfer_notice', 'Asset Transfer Notice: {{asset_tag}} moved to {{to_department}}', '<p>Asset <strong>{{asset_name}}</strong> (Tag: <code>{{asset_tag}}</code>) has been transferred from <strong>{{from_department}}</strong> to <strong>{{to_department}}</strong>.</p><p>Transferred by: {{transferred_by}}</p>', 'Notifies department heads on asset transfer');
