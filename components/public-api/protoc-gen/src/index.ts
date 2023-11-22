/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PlainMessage, toPlainMessage } from "@bufbuild/protobuf";
import { createEcmaScriptPlugin, runNodeJs } from "@bufbuild/protoplugin";
import { findCustomMessageOption } from "@bufbuild/protoplugin/ecmascript";
import type { Schema } from "@bufbuild/protoplugin/ecmascript";
import { ServiceMethodOptions } from "@gitpod/public-api/lib/gitpod/v1/options_pb";

runNodeJs(
    createEcmaScriptPlugin({
        name: "protoc-gen-public-api",
        version: `v0.1.5`,
        generateTs: (schema: Schema) => {
            const files = schema.files.filter((file) => file.name.startsWith("gitpod/v1/"));
            if (files.length === 0) {
                return;
            }
            const jsonFile = schema.generateFile("service-method-options.json");
            const obj: {
                [serviceName: string]: {
                    [methodName: string]: PlainMessage<ServiceMethodOptions>;
                };
            } = {};
            for (const file of files) {
                for (const service of file.services) {
                    obj[service.typeName] = {};
                    for (const method of service.methods) {
                        const options =
                            findCustomMessageOption(method, 50001, ServiceMethodOptions) || new ServiceMethodOptions();
                        obj[service.typeName][method.name] = toPlainMessage(options);
                    }
                }
            }
            jsonFile.print(JSON.stringify(obj, undefined, 2));
        },
    }),
);
