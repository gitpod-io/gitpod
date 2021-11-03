-- Copyright (c) 2021 Gitpod GmbH. All rights reserved.
-- Licensed under the GNU Affero General Public License (AGPL).
-- See License-AGPL.txt in the project root for license information.

create procedure migrations_0_2_0_down()
begin

    set @is_id_column_present := (SELECT true
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE   table_schema = 'gitpod'
            AND table_name = 'migrations'
            AND column_name = 'id');

    if @is_id_column_present IS NOT NULL then
        ALTER TABLE migrations MODIFY COLUMN id int(11);
        ALTER TABLE migrations DROP PRIMARY KEY;
        ALTER TABLE migrations ADD PRIMARY KEY (timestamp);
        ALTER TABLE migrations DROP COLUMN id;
    end if;

end;
