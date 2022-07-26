/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { CostCenter } from "@gitpod/gitpod-protocol";

export const CostCenterDB = Symbol("CostCenterDB");
export interface CostCenterDB {
    storeEntry(ts: CostCenter): Promise<void>;
    findById(id: string): Promise<CostCenter | undefined>;
}
