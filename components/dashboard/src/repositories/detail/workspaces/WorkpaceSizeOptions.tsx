/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { RadioGroupItem, RadioListField } from "../../../components/podkit/forms/RadioListField";
import { useState } from "react";
import { useWorkspaceClasses } from "../../../data/workspaces/workspace-classes-query";

interface Props {
    configuration: Configuration;
}

export const ConfigurationWorkspaceSizeOptions = ({ configuration }: Props) => {
    const [selectedValue, setSelectedValue] = useState(
        configuration.workspaceSettings?.workspaceClass || "g1-standard",
    );
    const { data: classes, isError, isLoading } = useWorkspaceClasses();

    if (isError) {
        return <div>Something went wrong</div>;
    }

    if (isLoading || !classes) {
        return <div>Loading...</div>;
    }

    return (
        <RadioListField
            selectedValue={selectedValue}
            onChange={setSelectedValue}
            children={classes.map((c) => ({
                radio: <RadioGroupItem value={c.id} />,
                label: c.displayName,
                hint: c.description,
            }))}
        />
    );
};
