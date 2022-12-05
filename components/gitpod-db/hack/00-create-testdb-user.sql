-- Copyright (c) 2020 Gitpod GmbH. All rights reserved.
-- Licensed under the GNU Affero General Public License (AGPL). See License.AGPL.txt in the project root for license information.


-- create test DB user
SET @gitpodDbPassword = IFNULL(@gitpodDbPassword, 'test');

SET @statementStr = CONCAT(
    'CREATE USER IF NOT EXISTS "gitpod"@"%" IDENTIFIED BY "', @gitpodDbPassword, '";'
);
SELECT @statementStr ;
PREPARE stmt FROM @statementStr; EXECUTE stmt; DEALLOCATE PREPARE stmt;
