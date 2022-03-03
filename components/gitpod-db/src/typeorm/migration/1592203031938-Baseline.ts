/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

import { BUILTIN_WORKSPACE_PROBE_USER_ID } from '../../user-db';

export class Baseline1592203031938 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const createTables = [
            `CREATE TABLE IF NOT EXISTS d_b_account_entry (  id int(11) DEFAULT NULL,  userId char(36) NOT NULL,  amount double NOT NULL,  date varchar(255) NOT NULL,  expiryDate varchar(255) NOT NULL DEFAULT '',  kind char(7) NOT NULL,  description text,  uid char(36) NOT NULL,  creditId char(36) DEFAULT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (uid),  KEY ind_dbsync (_lastModified),  KEY ind_expiryDate (expiryDate)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_app_installation (  platform varchar(255) NOT NULL,  installationID varchar(255) NOT NULL,  ownerUserID char(36) DEFAULT NULL,  platformUserID varchar(255) DEFAULT NULL,  state char(36) NOT NULL,  creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  lastUpdateTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (platform,installationID,state),  KEY ind_dbsync (creationTime)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_auth_provider_entry (  id varchar(255) NOT NULL,  ownerId char(36) NOT NULL,  status varchar(25) NOT NULL,  host varchar(255) NOT NULL,  type varchar(100) NOT NULL,  oauth text NOT NULL,  deleted tinyint(4) NOT NULL DEFAULT '0',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_edu_email_domain (  domain varchar(255) NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (domain),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_email (  uid char(36) NOT NULL,  userId char(36) NOT NULL,  recipientAddress varchar(255) NOT NULL,  params json NOT NULL,  scheduledInternalTime varchar(255) NOT NULL,  scheduledSendgridTime varchar(255) NOT NULL DEFAULT '',  error varchar(255) NOT NULL DEFAULT '',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  campaignId varchar(30) NOT NULL,  PRIMARY KEY (uid),  KEY ind_scheduledSendgridTime (scheduledSendgridTime),  KEY ind_lastModified (_lastModified),  KEY ind_campaignId_userId (campaignId,userId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_email_domain_filter (  domain varchar(255) NOT NULL,  negative tinyint(4) NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (domain),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_email_notification_data (  type varchar(30) NOT NULL,  notificationId varchar(30) NOT NULL,  userId char(36) NOT NULL,  done tinyint(4) NOT NULL,  reevaluateAfter varchar(255) NOT NULL,  data json NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (type,notificationId,userId),  KEY ind_lastModified (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_generated_license (  id char(36) NOT NULL,  domain varchar(255) NOT NULL,  ownerId char(36) NOT NULL,  creationTime varchar(255) NOT NULL,  code text NOT NULL,  type varchar(12) NOT NULL,  PRIMARY KEY (id),  UNIQUE KEY ind_4489aa4b8a776e7109f40bb088 (domain)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_gitpod_token (  tokenHash varchar(255) NOT NULL,  name varchar(255) DEFAULT NULL,  type int(11) NOT NULL,  userId char(36) NOT NULL,  scopes varchar(255) NOT NULL DEFAULT '',  created varchar(255) NOT NULL DEFAULT '',  deleted tinyint(4) NOT NULL DEFAULT '0',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (tokenHash),  KEY ind_lastModified (_lastModified),  KEY ind_userId (userId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_identity (  authProviderId varchar(255) NOT NULL,  authId varchar(255) NOT NULL,  authName varchar(255) NOT NULL,  primaryEmail varchar(255) NOT NULL DEFAULT '',  tokens text NOT NULL,  userId char(36) DEFAULT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  deleted tinyint(4) NOT NULL DEFAULT '0',  readonly tinyint(4) NOT NULL DEFAULT '0',  PRIMARY KEY (authProviderId,authId),  KEY ind_authProviderId_authName (authProviderId,authName),  KEY ind_dbsync (_lastModified),  KEY ind_identity_userId (userId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_layout_data (  workspaceId char(36) NOT NULL,  lastUpdatedTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  layoutData mediumtext NOT NULL,  PRIMARY KEY (workspaceId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_one_time_secret (  id char(36) NOT NULL,  value text NOT NULL,  expirationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  deleted tinyint(4) NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_payment_source_info (  id varchar(255) NOT NULL,  resourceVersion bigint(13) NOT NULL,  userId char(36) NOT NULL,  status varchar(255) NOT NULL DEFAULT '',  cardExpiryMonth int(11) NOT NULL,  cardExpiryYear int(11) NOT NULL,  softDeletedTime varchar(30) NOT NULL DEFAULT '',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id,resourceVersion),  KEY ind_userId_softDeletedTime (userId,softDeletedTime),  KEY ind_resourceVersion (resourceVersion),  KEY ind_lastModified (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_pending_github_event (  id char(36) NOT NULL,  githubUserId varchar(36) NOT NULL,  creationDate timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  type varchar(128) NOT NULL,  event text,  PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_prebuilt_workspace (  id char(36) NOT NULL,  cloneURL varchar(255) NOT NULL,  commit varchar(255) NOT NULL,  state varchar(255) NOT NULL,  creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  buildWorkspaceId char(36) NOT NULL,  snapshot varchar(255) NOT NULL DEFAULT '',  error varchar(255) NOT NULL DEFAULT '',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id),  KEY ind_ac4a9aece1a455da0dc653888f (cloneURL,commit),  KEY ind_6a04b7005d5ad0e664725f9f17 (state),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_prebuilt_workspace_updatable (  id char(36) NOT NULL,  prebuiltWorkspaceId char(36) NOT NULL,  owner varchar(255) NOT NULL,  repo varchar(255) NOT NULL,  isResolved tinyint(4) NOT NULL,  installationId varchar(255) NOT NULL,  issue varchar(255) NOT NULL DEFAULT '',  label varchar(255) NOT NULL DEFAULT '',  contextUrl text,  PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_repository_white_list (  url char(128) NOT NULL,  description text NOT NULL,  priority int(11) NOT NULL DEFAULT '10',  PRIMARY KEY (url)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_snapshot (  id char(36) NOT NULL,  creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  originalWorkspaceId char(36) NOT NULL,  bucketId varchar(255) NOT NULL,  layoutData mediumtext,  PRIMARY KEY (id),  KEY ind_originalWorkspaceId (originalWorkspaceId),  KEY ind_dbsync (creationTime)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_subscription (  id int(11) DEFAULT NULL,  userId char(36) NOT NULL,  startDate varchar(255) NOT NULL,  endDate varchar(255) NOT NULL DEFAULT '',  amount double NOT NULL,  uid char(36) NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  planId varchar(255) NOT NULL DEFAULT 'free',  paymentReference varchar(255) NOT NULL DEFAULT '',  deleted tinyint(4) NOT NULL DEFAULT '0',  cancellationDate varchar(255) NOT NULL DEFAULT '',  paymentData text,  teamSubscriptionSlotId char(255) NOT NULL DEFAULT '',  firstMonthAmount double DEFAULT NULL,  PRIMARY KEY (uid),  KEY ind_user_paymentReference (userId,paymentReference),  KEY ind_dbsync (_lastModified),  KEY ind_planId (planId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_subscription_additional_data (  paymentReference varchar(255) NOT NULL,  mrr int(11) NOT NULL,  coupons text,  lastInvoiceAmount int(11) NOT NULL,  nextBilling varchar(255) NOT NULL DEFAULT '',  lastInvoice varchar(255) NOT NULL DEFAULT '',  lastUpdated varchar(255) NOT NULL DEFAULT '',  lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (paymentReference)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_team_subscription (  id varchar(255) NOT NULL,  userId char(36) NOT NULL,  paymentReference varchar(255) NOT NULL,  startDate varchar(255) NOT NULL,  endDate varchar(255) NOT NULL DEFAULT '',  planId varchar(255) NOT NULL,  quantity int(11) NOT NULL,  cancellationDate varchar(255) NOT NULL DEFAULT '',  deleted tinyint(4) NOT NULL DEFAULT '0',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id),  KEY ind_user_paymentReference (userId,paymentReference),  KEY ind_user_startDate (userId,startDate),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_team_subscription_slot (  id char(36) NOT NULL,  teamSubscriptionId char(36) NOT NULL,  assigneeId char(36) NOT NULL DEFAULT '',  assigneeIdentifier text,  subscriptionId char(36) NOT NULL DEFAULT '',  cancellationDate varchar(255) NOT NULL DEFAULT '',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id),  KEY ind_tsid (teamSubscriptionId),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_theia_plugin (  id char(36) NOT NULL,  pluginName varchar(255) NOT NULL,  pluginId varchar(255) NOT NULL DEFAULT '',  userId char(36) NOT NULL DEFAULT '',  bucketName varchar(255) NOT NULL,  path varchar(255) NOT NULL,  hash varchar(255) DEFAULT NULL,  state char(25) NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id),  KEY ind_plugin_state_hash (pluginId,state,hash),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_token_entry (  authProviderId varchar(255) NOT NULL,  authId varchar(255) NOT NULL,  token text NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  deleted tinyint(4) NOT NULL DEFAULT '0',  uid char(128) NOT NULL,  expiryDate varchar(255) NOT NULL DEFAULT '',  refreshable tinyint(4) NOT NULL DEFAULT '0',  PRIMARY KEY (uid),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_user (  id char(36) NOT NULL,  creationDate varchar(255) NOT NULL DEFAULT '',  avatarUrl varchar(255) NOT NULL DEFAULT '',  name varchar(255) NOT NULL DEFAULT '',  fullName varchar(255) NOT NULL DEFAULT '',  allowsMarketingCommunication tinyint(4) NOT NULL DEFAULT '0',  blocked tinyint(4) NOT NULL DEFAULT '0',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  privileged tinyint(4) NOT NULL DEFAULT '0',  markedDeleted tinyint(4) NOT NULL DEFAULT '0',  noReleasePeriod tinyint(4) NOT NULL DEFAULT '0',  featureFlags text,  rolesOrPermissions text,  additionalData text,  PRIMARY KEY (id),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_user_env_var (  id char(36) NOT NULL,  userId char(36) NOT NULL,  name varchar(255) NOT NULL,  value text NOT NULL,  repositoryPattern varchar(255) NOT NULL DEFAULT '*/*',  deleted tinyint(4) NOT NULL DEFAULT '0',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id,userId),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_user_message_view_entry (  id int(11) DEFAULT NULL,  userId varchar(255) NOT NULL,  userMessageId varchar(255) NOT NULL,  viewedAt timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (userId,userMessageId),  KEY ind_dbsync (viewedAt)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_user_storage_resource (  id int(11) DEFAULT NULL,  userId varchar(255) NOT NULL,  uri varchar(255) NOT NULL,  content longtext NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  deleted tinyint(4) NOT NULL DEFAULT '0',  PRIMARY KEY (userId,uri),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_workspace (  id char(36) NOT NULL,  creationTime varchar(255) NOT NULL,  ownerId char(36) NOT NULL,  contextURL text NOT NULL,  description varchar(255) NOT NULL,  context text NOT NULL,  config text NOT NULL,  imageSource text,  imageNameResolved varchar(255) NOT NULL DEFAULT '',  archived tinyint(4) NOT NULL DEFAULT '0',  shareable tinyint(4) NOT NULL DEFAULT '0',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  deleted tinyint(4) NOT NULL DEFAULT '0',  type char(16) NOT NULL DEFAULT 'regular',  baseImageNameResolved varchar(255) NOT NULL DEFAULT '',  softDeleted char(4) DEFAULT NULL,  pinned tinyint(4) NOT NULL DEFAULT '0',  softDeletedTime varchar(255) NOT NULL DEFAULT '',  contentDeletedTime varchar(255) NOT NULL DEFAULT '',  basedOnPrebuildId char(36) DEFAULT NULL,  basedOnSnapshotId char(36) DEFAULT NULL,  PRIMARY KEY (id),  KEY ind_deb7c20cf2cce89de2b1bf882f (ownerId),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_workspace_instance (  id char(36) NOT NULL,  workspaceId char(36) NOT NULL,  region varchar(255) NOT NULL,  creationTime varchar(255) NOT NULL,  startedTime varchar(255) NOT NULL DEFAULT '',  deployedTime varchar(255) NOT NULL DEFAULT '',  stoppedTime varchar(255) NOT NULL DEFAULT '',  lastHeartbeat varchar(255) NOT NULL DEFAULT '',  ideUrl varchar(255) NOT NULL,  workspaceBaseImage varchar(255) NOT NULL DEFAULT '',  workspaceImage varchar(255) NOT NULL,  status_old varchar(255) DEFAULT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  status json NOT NULL,  phase char(32) GENERATED ALWAYS AS (json_unquote(json_extract(status,'$.phase'))) VIRTUAL,  deleted tinyint(4) NOT NULL DEFAULT '0',  phasePersisted char(32) NOT NULL DEFAULT '',  configuration text,  PRIMARY KEY (id),  KEY ind_57a78fc47596636bc71e619c12 (workspaceId),  KEY ind_find_wsi_ws_in_period (workspaceId,startedTime,stoppedTime),  KEY ind_dbsync (_lastModified),  KEY ind_phasePersisted (phasePersisted),  KEY ind_instance_phase (phase)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_workspace_instance_user (  instanceId char(36) NOT NULL,  userId varchar(255) NOT NULL,  lastSeen timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  wasClosed tinyint(4) NOT NULL DEFAULT '0',  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (instanceId,userId),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
            `CREATE TABLE IF NOT EXISTS d_b_workspace_report_entry (  id int(11) DEFAULT NULL,  instanceId varchar(255) NOT NULL,  data varchar(255) NOT NULL,  time timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  uid char(36) NOT NULL,  PRIMARY KEY (uid),  KEY ind_dbsync (time)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        ];
        for (const createTable of createTables) {
            await queryRunner.query(createTable);
        }

        // features repositories
        {
            const count = (await queryRunner.query(`SELECT COUNT(1) AS cnt FROM d_b_repository_white_list`))[0].cnt;
            if (Number.parseInt(count) < 1) {
                const entries = [
                    {
                        url: 'https://github.com/gitpod-io/go-gin-app.git',
                        description: '**Go** - A simple web app implemented in Go and Gin',
                        priority: 7,
                    },
                    {
                        url: 'https://github.com/gitpod-io/rails_sample_app',
                        description: '**Ruby on Rails** - Tutorial sample application',
                        priority: 6,
                    },
                    {
                        url: 'https://github.com/gitpod-io/NextSimpleStarter.git',
                        description: '**JavaScript** - Simple PWA boilerplate with Next.js and Redux',
                        priority: 8,
                    },
                    {
                        url: 'https://github.com/gitpod-io/django-locallibrary-tutorial',
                        description: '**Python** - Tutorial "Local Library" website written in Django',
                        priority: 10,
                    },
                    {
                        url: 'https://github.com/gitpod-io/gs-spring-boot.git',
                        description: '**Java** - Building an Application with Spring Boot',
                        priority: 9,
                    },
                    {
                        url: 'https://github.com/gitpod-io/symfony-demo.git',
                        description: '**PHP** - Symfony Demo Application',
                        priority: 5,
                    },
                    {
                        url: 'https://github.com/theia-ide/theia.git',
                        description: "**Typescript** - Deep dive into Gitpod\\'s open-source IDE, Theia.",
                        priority: 4,
                    },
                ];
                await Promise.all(
                    entries.map((e) =>
                        queryRunner.query(
                            `INSERT IGNORE INTO d_b_repository_white_list (url, description, priority) VALUES (?, ?, ?)`,
                            [e.url, e.description, e.priority],
                        ),
                    ),
                );
            }
        }

        // domain filters
        {
            const entries = [
                { domain: 'tempail.com', negative: true },
                { domain: 'ezehe.com', negative: true },
                { domain: 'radiodale.com', negative: true },
            ];
            const values = entries.map((e) => `('${e.domain}', '${e.negative ? 1 : 0}')`).join(',');
            await queryRunner.query(`INSERT IGNORE INTO d_b_email_domain_filter (domain, negative) VALUES ${values}`);
        }

        // probe user
        {
            const exists =
                (
                    await queryRunner.query(
                        `SELECT COUNT(1) AS cnt FROM d_b_user WHERE id = 'builtin-user-workspace-probe-0000000'`,
                    )
                )[0].cnt == 1;
            if (!exists) {
                await queryRunner.query(
                    `INSERT IGNORE INTO d_b_user (id, creationDate, avatarUrl, name, fullName) VALUES ('${BUILTIN_WORKSPACE_PROBE_USER_ID}', '${new Date().toISOString()}', '', 'builtin-workspace-prober', '')`,
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // this is a one-way idempotent 'migration', no rollback possible for a nonempty DB
    }
}
