/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PlainMessage } from "@bufbuild/protobuf";
import { ServiceMethodOptions } from "@gitpod/public-api/lib/gitpod/v1/options_pb";

export const serviceMethodOptions: {
    [serviceName: string]: {
        [methodName: string]: PlainMessage<ServiceMethodOptions>;
    };
} = require("./service-method-options.json");
