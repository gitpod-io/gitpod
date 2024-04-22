/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { ConfigurationWorkspaceSizeOptions } from "./workspaces/WorkpaceSizeOptions";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { ConfigurationWorkspaceClassesOptions } from "./workspaces/ConfigurationWorkspaceClassesOptions";
import { useFeatureFlag } from "../../data/featureflag-query";

type Props = {
    configuration: Configuration;
};
export const ConfigurationDetailWorkspaces: FC<Props> = ({ configuration }) => {
    const enabledWorkspaceClassRestrictionOnConfiguration = useFeatureFlag(
        "configuration_workspace_class_restrictions",
    );
    if (enabledWorkspaceClassRestrictionOnConfiguration) {
        return <ConfigurationWorkspaceClassesOptions configuration={configuration} />;
    }
    return <ConfigurationWorkspaceSizeOptions configuration={configuration} />;
};
