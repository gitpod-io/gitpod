/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Heading3, Subheading } from "@podkit/typography/Headings";
import { RemoveConfigurationModal } from "./RemoveConfigurationModal";
import { useHistory } from "react-router";
import { useCallback, useState } from "react";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { Button } from "@podkit/buttons/Button";

interface Props {
    configuration: Configuration;
}

export const RemoveConfiguration = ({ configuration }: Props) => {
    const [showRemoveModal, setShowRemoveModal] = useState(false);

    const history = useHistory();
    const onProjectRemoved = useCallback(() => {
        history.push("/repositories");
    }, [history]);

    return (
        <>
            <ConfigurationSettingsField>
                <Heading3>Remove this Configuration</Heading3>
                <Subheading className="max-w-lg">
                    This will delete the project and all project-level environment variables you've set for this
                    project. It will not delete the repository.
                </Subheading>

                <Button variant="destructive" className="mt-4" onClick={() => setShowRemoveModal(true)}>
                    Remove Configuration
                </Button>
            </ConfigurationSettingsField>
            {configuration && showRemoveModal && (
                <RemoveConfigurationModal
                    configuration={configuration}
                    onRemoved={onProjectRemoved}
                    onClose={() => setShowRemoveModal(false)}
                />
            )}
        </>
    );
};
