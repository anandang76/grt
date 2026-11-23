-- GR Trading schema (MySQL 5.7+/8). Run via: php install.php

CREATE TABLE IF NOT EXISTS roles (
  slug        VARCHAR(20)  NOT NULL PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  description VARCHAR(255) NOT NULL,
  rank_no     TINYINT      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO roles (slug, name, description, rank_no) VALUES
  ('superadmin', 'Super Admin', 'Full control: all users and admins, roles, password resets, activity log', 3),
  ('admin',      'Admin',       'Approve or reject signups, activate or deactivate users', 2),
  ('user',       'User',        'Trading terminal access', 1);

CREATE TABLE IF NOT EXISTS users (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(100) NOT NULL,
  email                VARCHAR(190) NOT NULL,
  phone                VARCHAR(15)  NULL,
  password_hash        VARCHAR(255) NULL,
  google_id            VARCHAR(64)  NULL,
  role                 VARCHAR(20)  NOT NULL DEFAULT 'user',
  status               ENUM('pending','active','inactive','rejected') NOT NULL DEFAULT 'pending',
  must_change_password TINYINT(1)   NOT NULL DEFAULT 0,
  email_verified_at    DATETIME NULL,
  terms_accepted_at    DATETIME NULL,
  approved_by          INT UNSIGNED NULL,
  approved_at          DATETIME NULL,
  last_login_at        DATETIME NULL,
  created_at           DATETIME NOT NULL,
  updated_at           DATETIME NULL,
  UNIQUE KEY uq_email (email),
  UNIQUE KEY uq_google (google_id),
  KEY ix_status (status),
  KEY ix_role (role),
  CONSTRAINT fk_users_role FOREIGN KEY (role) REFERENCES roles (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS otps (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(190) NOT NULL,
  purpose    VARCHAR(10)  NOT NULL,
  code_hash  CHAR(64)     NOT NULL,
  attempts   TINYINT      NOT NULL DEFAULT 0,
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME     NULL,
  created_at DATETIME     NOT NULL,
  KEY ix_email_purpose (email, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  k          VARCHAR(200) NOT NULL,
  created_at DATETIME     NOT NULL,
  KEY ix_k (k, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id   INT UNSIGNED NULL,
  action     VARCHAR(40)  NOT NULL,
  target_id  INT UNSIGNED NULL,
  meta       TEXT         NULL,
  ip         VARCHAR(45)  NULL,
  created_at DATETIME     NOT NULL,
  KEY ix_actor (actor_id),
  KEY ix_target (target_id),
  KEY ix_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
