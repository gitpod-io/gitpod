/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { EmptyMessage } from "../../components/EmptyMessage";
import { Item, ItemField, ItemFieldIcon, ItemsList } from "../../components/ItemsList";
import { Heading2, Subheading } from "../../components/typography/headings";
import { GitIntegrationListItem } from "./GitIntegrationListItem";
import { GitIntegrationModal } from "./GitIntegrationModal";
import { AuthProvider } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

type Props = {
    providers: AuthProvider[];
};
export const GitIntegrationsList: FunctionComponent<Props> = ({ providers }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);

    const onCreate = useCallback(() => setShowCreateModal(true), []);
    const hideModal = useCallback(() => setShowCreateModal(false), []);

    return (
        <>
            <div className="flex flex-col space-y-2 md:flex-row md:items-start md:justify-between md:space-y-0">
                <div>
                    <Heading2>Git Provider</Heading2>
                    <Subheading>Configure Git provider integrations for your organization.</Subheading>
                </div>

                {providers.length !== 0 ? (
                    <div>
                        <Button className="whitespace-nowrap" onClick={onCreate}>
                            New Git Provider
                        </Button>
                    </div>
                ) : null}
            </div>

            {providers.length === 0 ? (
                <EmptyMessage
                    title="No Git Providers"
                    subtitle="Configure a Git Provider with GitHub, GitLab, or Bitbucket Server."
                    buttonText="New Git Provider"
                    onClick={onCreate}
                />
            ) : (
                <ItemsList className="pt-6">
                    <Item header={true}>
                        <ItemFieldIcon />
                        <ItemField className="w-5/12">Provider Type</ItemField>
                        <ItemField className="w-6/12">Host Name</ItemField>
                    </Item>
                    {providers.map((p) => (
                        <GitIntegrationListItem key={p.id} provider={p} />
                    ))}
                </ItemsList>
            )}
            {showCreateModal && <GitIntegrationModal onClose={hideModal} />}
        </>
    );
};
