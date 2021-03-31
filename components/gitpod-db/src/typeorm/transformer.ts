/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ValueTransformer } from "typeorm/decorator/options/ValueTransformer";
import { EncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";


export namespace Transformer {
    export const MAP_EMPTY_STR_TO_UNDEFINED: ValueTransformer = {
        to(value: any): any {
            if (value === undefined) {
                return '';
            }
            return value;
        },
        from(value: any): any {
            if (value === '') {
                return undefined;
            }
            return value;
        }
    };

    export const MAP_ISO_STRING_TO_TIMESTAMP_DROP: ValueTransformer = {
        to(value: any): any {
            // DROP all input values as they are set by the DB 'ON UPDATE'/ as default value
            return undefined;
        },
        from(value: any): any {
            // From TIMESTAMP to ISO string
            return new Date(Date.parse(value)).toISOString();
        }
    };

    export const SIMPLE_JSON = (defaultValue: any) => {
        return <ValueTransformer> {
            to(value: any): any {
                return JSON.stringify(value || defaultValue);
            },
            from(value: any): any {
                return JSON.parse(value);
            }
        };
    }

    export const encrypted = (encryptionServiceProvider: () => EncryptionService): ValueTransformer => {
        return {
            to(value: any): any {
                return encryptionServiceProvider().encrypt(value);
            },
            from(value: any): any {
                return encryptionServiceProvider().decrypt(value);
            }
        };
    }

    export const compose = (upper: ValueTransformer, lower: ValueTransformer) => {
        return new CompositeValueTransformer(upper, lower);
    }
}

export class CompositeValueTransformer implements ValueTransformer {
    constructor(protected readonly upper: ValueTransformer,
                protected readonly lower: ValueTransformer) {}

    to(value: any): any {
        return this.lower.to(this.upper.to(value));
    }
    from(value: any): any {
        return this.upper.from(this.lower.from(value));
    }
}