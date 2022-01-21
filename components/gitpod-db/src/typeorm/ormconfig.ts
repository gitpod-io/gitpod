/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/* NOTE: This file is only used for the TypeORM CLI and not for TypeORM operations in our code (e.g. server).
 * It has to be compiled to Javascript first (e.g. yarn build) ... `yarn typeorm` expects this file as Javascript in lib/typeorm/ormconfig.js
 */
import { TypeORM } from './typeorm';
import { Config } from '../config';

module.exports = {
  ...TypeORM.defaultOptions(__dirname),
  ...new Config().dbConfig,
  database: process.env.DB_NAME || 'gitpod',
};
