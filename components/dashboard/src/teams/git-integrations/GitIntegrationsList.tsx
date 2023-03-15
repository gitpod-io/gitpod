/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { EmptyMessage } from "../../components/EmptyMessage";
import { Item, ItemField, ItemsList } from "../../components/ItemsList";
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
                <EmptyMessage
                    title="No Git Integrations"
                    subtitle="In addition to the default Git Providers you can authorize with a self-hosted instance of a provider."
                    buttonText="New Integration"
                    onClick={onCreate}
                />
            ) : (
                <>
                    <div className="mt-3">
                        <Button onClick={onCreate}>New Integration</Button>
                    </div>

                    <ItemsList className="pt-6">
                        <Item header={true}>
                            <ItemField className="w-1/12"> </ItemField>
                            <ItemField className="w-5/12">Provider Type</ItemField>
                            <ItemField className="w-6/12">Host Name</ItemField>
                        </Item>
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
