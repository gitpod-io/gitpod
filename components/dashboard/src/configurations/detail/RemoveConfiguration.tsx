/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Heading2, Subheading } from "@podkit/typography/Headings";
import { Button } from "../../components/Button";
import { RemoveConfigurationModal } from "./RemoveConfigurationModal";
import { useHistory } from "react-router";
import { useCallback, useState } from "react";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

interface Props {
    configuration: Configuration;
}

export const RemoveConfiguration = ({ configuration }: Props) => {
    const [showRemoveModal, setShowRemoveModal] = useState(false);

    const history = useHistory();
    const onProjectRemoved = useCallback(() => {
        history.push("/projects");
    }, [history]);

    return (
        <>
            <div className="mt-12 border border-gray-300 dark:border-gray-700 rounded-xl p-4">
                <Heading2>Remove this Configuration</Heading2>
                <Subheading className="pb-4 max-w-md dark:text-gray-400">
                    This will delete the project and all project-level environment variables you've set for this
                    project. It will not delete the repository.
                </Subheading>
                <Button type={"danger.secondary"} onClick={() => setShowRemoveModal(true)}>
                    Remove Configuration
                </Button>
            </div>
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
