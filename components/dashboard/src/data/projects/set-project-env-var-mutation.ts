/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { envVarClient } from "../../service/public-api";
import { EnvironmentVariableAdmission } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";

type SetProjectEnvVarArgs = {
    projectId: string;
    name: string;
    value: string;
    admission: EnvironmentVariableAdmission;
};
export const useSetProjectEnvVar = () => {
    return useMutation<void, Error, SetProjectEnvVarArgs>(async ({ projectId, name, value, admission }) => {
        await envVarClient.createConfigurationEnvironmentVariable({
            name,
            value,
            configurationId: projectId,
            admission,
        });
    });
};
