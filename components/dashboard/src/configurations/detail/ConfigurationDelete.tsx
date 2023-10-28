/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the repository root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { Button } from "@podkit/button/Button";
import { useCallback, useState } from "react";
import { useHistory } from "react-router";
import { Heading2, Subheading } from "../../components/typography/headings";
import { RemoveConfigurationModal } from "./ConfigurationDeleteModal";

interface RepositoryPrebuildsSettingsProps {
    configuration: Project;
}

export default function DeleteConfiguration({ configuration }: RepositoryPrebuildsSettingsProps) {
    const [showRemoveModal, setShowRemoveModal] = useState(false);

    const history = useHistory();

    const onProjectRemoved = useCallback(() => {
        history.push("/configurations");
    }, [history]);

    return (
        <>
            <section>
                <Heading2 className="mt-12">Remove Configuration</Heading2>
                <Subheading className="pb-4 max-w-md">
                    This will delete the configuration and all configuration-level environment variables you've set for
                    this configuration.
                </Subheading>
                <Button variant="destructive" onClick={() => setShowRemoveModal(true)}>
                    Remove Configuration
                </Button>
            </section>
            {showRemoveModal && (
                <RemoveConfigurationModal
                    configuration={configuration}
                    onRemoved={onProjectRemoved}
                    onClose={() => setShowRemoveModal(false)}
                />
            )}
        </>
    );
}
