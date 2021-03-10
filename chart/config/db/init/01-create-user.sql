-- Copyright (c) 2020 Gitpod GmbH. All rights reserved.
-- Licensed under the MIT License. See License-MIT.txt in the project root for license information.

-- must be idempotent

-- create user (parameterized)
SET @statementStr = CONCAT(
    'CREATE USER IF NOT EXISTS "gitpod"@"%" IDENTIFIED BY "', @gitpodDbPassword, '";'
);
SELECT @statementStr ;
PREPARE stmt FROM @statementStr; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Grant privileges
GRANT ALL ON `gitpod%`.* TO "gitpod"@"%";
