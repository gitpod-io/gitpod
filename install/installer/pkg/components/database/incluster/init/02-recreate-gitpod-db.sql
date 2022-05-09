-- Copyright (c) 2020 Gitpod GmbH. All rights reserved.
-- Licensed under the MIT License. See License-MIT.txt in the project root for license information.

-- must be idempotent

-- @gitpodDB contains name of the DB the script manipulates, and is replaced by the file reader
SET
@gitpodDB = IFNULL(@gitpodDB, '`__GITPOD_DB_NAME__`');

SET
@statementStr = CONCAT('DROP DATABASE IF EXISTS ', @gitpodDB);
PREPARE statement FROM @statementStr;
EXECUTE statement;

SET
@statementStr = CONCAT('CREATE DATABASE ', @gitpodDB, ' CHARSET utf8mb4');
PREPARE statement FROM @statementStr;
EXECUTE statement;
