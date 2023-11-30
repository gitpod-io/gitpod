/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ConfigurationVariableList } from "./variables/ConfigurationVariableList";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

type Props = {
    configuration: Configuration;
};
export const ConfigurationDetailVariables = ({ configuration }: Props) => {
    return <ConfigurationVariableList configuration={configuration} />;
};
