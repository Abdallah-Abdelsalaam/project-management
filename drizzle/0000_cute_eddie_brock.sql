CREATE TABLE `permission` (
	`key` varchar(64) NOT NULL,
	`group_key` varchar(32) NOT NULL,
	`label_ar` varchar(128) NOT NULL,
	`label_en` varchar(128) NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `permission_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `role` (
	`id` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`key` varchar(64) NOT NULL,
	`scope` varchar(8) NOT NULL DEFAULT 'own',
	`scope_label` varchar(128),
	`description` varchar(512),
	`icon` varchar(32) NOT NULL DEFAULT 'badge',
	`is_system` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `role_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_key_key` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `role_permission` (
	`role_id` varchar(64) NOT NULL,
	`permission_key` varchar(64) NOT NULL,
	CONSTRAINT `role_permission_role_id_permission_key_pk` PRIMARY KEY(`role_id`,`permission_key`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`provider_id` varchar(64) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scope` text,
	`id_token` text,
	`password` varchar(255),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_provider_account_key` UNIQUE(`provider_id`,`account_id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempt` (
	`id` varchar(64) NOT NULL,
	`email` varchar(255) NOT NULL,
	`ip_address` varchar(64),
	`user_agent` text,
	`succeeded` boolean NOT NULL DEFAULT false,
	`attempted_at` datetime(3) NOT NULL,
	CONSTRAINT `login_attempt_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_history` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `password_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(64) NOT NULL,
	`token` varchar(255) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`ip_address` varchar(64),
	`user_agent` text,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_key` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `trusted_device` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`trust_identifier` varchar(255) NOT NULL,
	`label` varchar(255) NOT NULL,
	`os` varchar(64) NOT NULL,
	`browser` varchar(64) NOT NULL,
	`kind` varchar(16) NOT NULL DEFAULT 'unknown',
	`ip_address` varchar(64),
	`last_seen_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `trusted_device_id` PRIMARY KEY(`id`),
	CONSTRAINT `trusted_device_trust_identifier_key` UNIQUE(`trust_identifier`)
);
--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` boolean NOT NULL DEFAULT true,
	`failed_verification_count` int NOT NULL DEFAULT 0,
	`locked_until` datetime(3),
	CONSTRAINT `two_factor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`role_id` varchar(64) NOT NULL,
	`two_factor_enabled` boolean NOT NULL DEFAULT false,
	`password_changed_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_key` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(64) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` varchar(64) NOT NULL,
	`actor_id` varchar(64),
	`action` varchar(64) NOT NULL,
	`entity_type` varchar(32) NOT NULL,
	`entity_id` varchar(128) NOT NULL,
	`field` varchar(64),
	`value_from` json,
	`value_to` json,
	`ip` varchar(64),
	`user_agent` text,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_role_id_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_history` ADD CONSTRAINT `password_history_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trusted_device` ADD CONSTRAINT `trusted_device_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `two_factor` ADD CONSTRAINT `two_factor_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_role_id_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `permission_group_key_sort_order_idx` ON `permission` (`group_key`,`sort_order`);--> statement-breakpoint
CREATE INDEX `role_sort_order_idx` ON `role` (`sort_order`);--> statement-breakpoint
CREATE INDEX `role_permission_role_id_idx` ON `role_permission` (`role_id`);--> statement-breakpoint
CREATE INDEX `role_permission_permission_key_idx` ON `role_permission` (`permission_key`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `login_attempt_email_attempted_at_idx` ON `login_attempt` (`email`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `password_history_user_id_idx` ON `password_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_history_user_id_created_at_idx` ON `password_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_user_id_expires_at_idx` ON `session` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `trusted_device_user_id_idx` ON `trusted_device` (`user_id`);--> statement-breakpoint
CREATE INDEX `trusted_device_user_id_last_seen_at_idx` ON `trusted_device` (`user_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `trusted_device_user_id_expires_at_idx` ON `trusted_device` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `two_factor_user_id_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_role_id_idx` ON `user` (`role_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `verification_expires_at_idx` ON `verification` (`expires_at`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_id_idx` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);