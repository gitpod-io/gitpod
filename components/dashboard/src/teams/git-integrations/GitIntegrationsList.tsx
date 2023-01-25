/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useState } from "react";
import { ItemsList } from "../../components/ItemsList";
import { GitIntegrationListItem } from "./GitIntegrationListItem";
import { GitIntegrationModal } from "./GitIntegrationModal";

type Props = {
    providers: AuthProviderEntry[];
};
export const GitIntegrationsList: FunctionComponent<Props> = ({ providers }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);

    const onCreate = useCallback(() => setShowCreateModal(true), []);
    const hideModal = useCallback(() => setShowCreateModal(false), []);

    return (
        <>
            {providers.length === 0 ? (
                <div className="w-full flex h-80 mt-2 rounded-xl bg-gray-100 dark:bg-gray-900">
                    <div className="m-auto text-center px-8">
                        <h3 className="self-center text-gray-500 dark:text-gray-400 mb-4">No Git Integrations</h3>
                        <div className="text-gray-500 mb-6 max-w-md">
                            In addition to the default Git Providers you can authorize with a self-hosted instance of a
                            provider.
                        </div>
                        <button className="self-center" onClick={onCreate}>
                            New Integration
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mt-3">
                        <button onClick={onCreate}>New Integration</button>
                    </div>

                    <ItemsList className="pt-6">
                        {providers.map((p) => (
                            <GitIntegrationListItem key={p.id} provider={p} />
                        ))}
                    </ItemsList>
                </>
            )}
            {showCreateModal && <GitIntegrationModal onClose={hideModal} />}
        </>
    );
};
