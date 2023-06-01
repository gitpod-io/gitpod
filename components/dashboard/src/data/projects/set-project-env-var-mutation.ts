/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

type SetProjectEnvVarArgs = {
    projectId: string;
    name: string;
    value: string;
    censored: boolean;
};
export const useSetProjectEnvVar = () => {
    return useMutation<void, Error, SetProjectEnvVarArgs>(async ({ projectId, name, value, censored }) => {
        return getGitpodService().server.setProjectEnvironmentVariable(projectId, name, value, censored);
    });
};
