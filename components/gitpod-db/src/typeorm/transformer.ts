/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ValueTransformer } from "typeorm/decorator/options/ValueTransformer";
import { EncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";

export namespace Transformer {
    export const MAP_EMPTY_STR_TO_UNDEFINED: ValueTransformer = {
        to(value: any): any {
            if (value === undefined) {
                return "";
            }
            return value;
        },
        from(value: any): any {
            if (value === "") {
                return undefined;
            }
            return value;
        },
    };

    export const MAP_ZERO_TO_UNDEFINED: ValueTransformer = {
        to(value: any): any {
            if (value === undefined) {
                return 0;
            }
            return value;
        },
        from(value: any): any {
            if (value === 0) {
                return undefined;
            }
            return value;
        },
    };

    export const MAP_NULL_TO_UNDEFINED: ValueTransformer = {
        to(value: any): any {
            if (value === undefined) {
                return null;
            }
            return value;
        },
        from(value: any): any {
            if (value === null) {
                return undefined;
            }
            return value;
        },
    };

    export const MAP_ISO_STRING_TO_TIMESTAMP_DROP: ValueTransformer = {
        to(value: any): any {
            // DROP all input values as they are set by the DB 'ON UPDATE'/ as default value.
            // We're relying on the system variable explicit-defaults-for-timestamp here (link: https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_explicit_defaults_for_timestamp):
            // `undefined` gets converted to NULL, which on the DB is turned into the configured default value for the column.
            // In our case, that's 100% CURRENT_TIMESTAMP.
            // This was done initially so we don't have to make fields like `creationTime` optional, or have to use two types for the same table.
            return undefined;
        },
        from(value: any): any {
            // From TIMESTAMP to ISO string
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return new Date(Date.parse(value)).toISOString();
        },
    };

    export const SIMPLE_JSON = (defaultValue: any) => {
        return <ValueTransformer>{
            to(value: any): any {
                return JSON.stringify(value || defaultValue);
            },
            from(value: any): any {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return JSON.parse(value);
            },
        };
    };

    export const SIMPLE_JSON_CUSTOM = (
        defaultValue: any,
        replacer?: (this: any, key: string, value: any) => any,
        reviver?: (this: any, key: string, value: any) => any,
    ) => {
        return <ValueTransformer>{
            to(value: any): any {
                return JSON.stringify(value || defaultValue, replacer);
            },
            from(value: any): any {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return JSON.parse(value, reviver);
            },
        };
    };

    export const encrypted = (encryptionServiceProvider: () => EncryptionService): ValueTransformer => {
        return {
            to(value: any): any {
                return encryptionServiceProvider().encrypt(value);
            },
            from(value: any): any {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return encryptionServiceProvider().decrypt(value);
            },
        };
    };

    export const compose = (upper: ValueTransformer, lower: ValueTransformer) => {
        return new CompositeValueTransformer(upper, lower);
    };

    export const MAP_BIGINT_TO_NUMBER: ValueTransformer = {
        to(value: any): any {
            // we expect to receive a number, as that's what our type system gives us.
            const isNumber = typeof value === "number";
            if (!isNumber) {
                return "0";
            }

            return value.toString();
        },
        from(value: any): any {
            // the underlying representation of a BIGINT is a string
            const isString = typeof value === "string" || value instanceof String;
            if (!isString) {
                return 0;
            }

            const num = Number(value);
            if (isNaN(num)) {
                return 0;
            }

            return num;
        },
    };

    export const ALWAYS_EMPTY_STRING: ValueTransformer = {
        to(value: any): any {
            return "";
        },
        from(value: any): any {
            return "";
        },
    };
}

export class CompositeValueTransformer implements ValueTransformer {
    constructor(protected readonly upper: ValueTransformer, protected readonly lower: ValueTransformer) {}

    to(value: any): any {
        return this.lower.to(this.upper.to(value));
    }
    from(value: any): any {
        return this.upper.from(this.lower.from(value));
    }
}
