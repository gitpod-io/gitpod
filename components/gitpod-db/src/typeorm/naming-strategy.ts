/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// The following is copied (license: MIT) from https://github.com/typeorm/typeorm/blob/master/src/naming-strategy/DefaultNamingStrategy.ts
// to be able to adjust it to be backwards compatible with https://github.com/typeorm/typeorm/blob/0.1.19/src/naming-strategy/DefaultNamingStrategy.ts
// by replacing calls to "snakeCase" with "snakeCase_0_1_20" (cmp. https://github.com/typeorm/typeorm/blob/0.1.19/src/util/StringUtils.ts#L13-L20).

import { Table } from "typeorm";
import { NamingStrategyInterface } from "typeorm/naming-strategy/NamingStrategyInterface";
import { RandomGenerator } from "typeorm/util/RandomGenerator";
import { camelCase, titleCase } from "typeorm/util/StringUtils";

const snakeCase_0_1_20 = (str: string) => {
    return str.replace(/(?:^|\.?)([A-Z])/g, (x, y) => "_" + y.toLowerCase()).replace(/^_/, "");
};

/**
 * Naming strategy that is used by default.
 */
export class DefaultNamingStrategy implements NamingStrategyInterface {
    private getTableName(tableOrName: Table | string): string {
        if (tableOrName instanceof Table) {
            tableOrName = tableOrName.name;
        }

        return tableOrName.split(".").pop()!;
    }
    /**
     * Normalizes table name.
     *
     * @param targetName Name of the target entity that can be used to generate a table name.
     * @param userSpecifiedName For example if user specified a table name in a decorator, e.g. @Entity("name")
     */
    tableName(targetName: string, userSpecifiedName: string | undefined): string {
        return userSpecifiedName ? userSpecifiedName : snakeCase_0_1_20(targetName);
    }

    /**
     * Creates a table name for a junction table of a closure table.
     *
     * @param originalClosureTableName Name of the closure table which owns this junction table.
     */
    closureJunctionTableName(originalClosureTableName: string): string {
        return originalClosureTableName + "_closure";
    }

    columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
        const name = customName || propertyName;

        if (embeddedPrefixes.length) return camelCase(embeddedPrefixes.join("_")) + titleCase(name);

        return name;
    }

    relationName(propertyName: string): string {
        return propertyName;
    }

    primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
        // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
        const clonedColumnNames = [...columnNames];
        clonedColumnNames.sort();
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        const key = `${replacedTableName}_${clonedColumnNames.join("_")}`;
        return "PK_" + RandomGenerator.sha1(key).substr(0, 27);
    }

    uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
        // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
        const clonedColumnNames = [...columnNames];
        clonedColumnNames.sort();
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        const key = `${replacedTableName}_${clonedColumnNames.join("_")}`;
        return "UQ_" + RandomGenerator.sha1(key).substr(0, 27);
    }

    relationConstraintName(tableOrName: Table | string, columnNames: string[], where?: string): string {
        // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
        const clonedColumnNames = [...columnNames];
        clonedColumnNames.sort();
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        let key = `${replacedTableName}_${clonedColumnNames.join("_")}`;
        if (where) key += `_${where}`;

        return "REL_" + RandomGenerator.sha1(key).substr(0, 26);
    }

    defaultConstraintName(tableOrName: Table | string, columnName: string): string {
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        const key = `${replacedTableName}_${columnName}`;
        return "DF_" + RandomGenerator.sha1(key).substr(0, 27);
    }

    foreignKeyName(
        tableOrName: Table | string,
        columnNames: string[],
        _referencedTablePath?: string,
        _referencedColumnNames?: string[],
    ): string {
        // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
        const clonedColumnNames = [...columnNames];
        clonedColumnNames.sort();
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        const key = `${replacedTableName}_${clonedColumnNames.join("_")}`;
        return "FK_" + RandomGenerator.sha1(key).substr(0, 27);
    }

    indexName(tableOrName: Table | string, columnNames: string[], where?: string): string {
        // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
        const clonedColumnNames = [...columnNames];
        clonedColumnNames.sort();
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        let key = `${replacedTableName}_${clonedColumnNames.join("_")}`;
        if (where) key += `_${where}`;

        return "IDX_" + RandomGenerator.sha1(key).substr(0, 26);
    }

    checkConstraintName(tableOrName: Table | string, expression: string, isEnum?: boolean): string {
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        const key = `${replacedTableName}_${expression}`;
        const name = "CHK_" + RandomGenerator.sha1(key).substr(0, 26);
        return isEnum ? `${name}_ENUM` : name;
    }

    exclusionConstraintName(tableOrName: Table | string, expression: string): string {
        const tableName = this.getTableName(tableOrName);
        const replacedTableName = tableName.replace(".", "_");
        const key = `${replacedTableName}_${expression}`;
        return "XCL_" + RandomGenerator.sha1(key).substr(0, 26);
    }

    joinColumnName(relationName: string, referencedColumnName: string): string {
        return camelCase(relationName + "_" + referencedColumnName);
    }

    joinTableName(
        firstTableName: string,
        secondTableName: string,
        firstPropertyName: string,
        secondPropertyName: string,
    ): string {
        return snakeCase_0_1_20(firstTableName + "_" + firstPropertyName.replace(/\./gi, "_") + "_" + secondTableName);
    }

    joinTableColumnDuplicationPrefix(columnName: string, index: number): string {
        return columnName + "_" + index;
    }

    joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
        return camelCase(tableName + "_" + (columnName ? columnName : propertyName));
    }

    joinTableInverseColumnName(tableName: string, propertyName: string, columnName?: string): string {
        return this.joinTableColumnName(tableName, propertyName, columnName);
    }

    /**
     * Adds globally set prefix to the table name.
     * This method is executed no matter if prefix was set or not.
     * Table name is either user's given table name, either name generated from entity target.
     * Note that table name comes here already normalized by #tableName method.
     */
    prefixTableName(prefix: string, tableName: string): string {
        return prefix + tableName;
    }

    eagerJoinRelationAlias(alias: string, propertyPath: string): string {
        return alias + "_" + propertyPath.replace(".", "_");
    }

    nestedSetColumnNames = { left: "nsleft", right: "nsright" };
    materializedPathColumnName = "mpath";
}
