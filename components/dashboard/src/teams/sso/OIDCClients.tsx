/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { EmptyMessage } from "../../components/EmptyMessage";
import { Item, ItemField, ItemsList } from "../../components/ItemsList";
import { SpinnerLoader } from "../../components/Loader";
import { Heading2, Subheading } from "../../components/typography/headings";
import { useOIDCClientsQuery } from "../../data/oidc-clients/oidc-clients-query";
import { OIDCClientConfigModal } from "./OIDCClientConfigModal";
import { OIDCClientListItem } from "./OIDCClientListItem";

export const OIDCClients: FC = () => {
    const { data, isLoading } = useOIDCClientsQuery();

    if (isLoading) {
        return <SpinnerLoader />;
    }

    return <OIDCClientsList clientConfigs={data || []} />;
};

type OIDCClientsListProps = {
    clientConfigs: OIDCClientConfig[];
};
const OIDCClientsList: FC<OIDCClientsListProps> = ({ clientConfigs }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);

    const onCreate = useCallback(() => setShowCreateModal(true), []);
    const hideModal = useCallback(() => setShowCreateModal(false), []);

    return (
        <>
            {showCreateModal && <OIDCClientConfigModal onClose={hideModal} />}

            <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                <div>
                    <Heading2>OpenID Connect clients</Heading2>
                    <Subheading>Configure single sign-on for your organization.</Subheading>
                </div>

                {clientConfigs.length !== 0 ? (
                    <div className="">
                        <Button className="whitespace-nowrap" onClick={onCreate}>
                            New OIDC Client
                        </Button>
                    </div>
                ) : null}
            </div>

            {clientConfigs.length === 0 ? (
                <EmptyMessage
                    title="No OIDC providers"
                    subtitle="Enable single sign-on for your organization using an external identity provider (IdP) service that supports the OpenID Connect (OIDC) standard, such as Google."
                    buttonText="New OIDC Client"
                    onClick={onCreate}
                />
            ) : (
                <ItemsList className="pt-6">
                    <Item header={true}>
                        <ItemField className="flex flex-col">
                            <span>Issuer URL</span>
                            <span>ID</span>
                        </ItemField>
                    </Item>
                    {clientConfigs.map((cc) => (
                        <OIDCClientListItem key={cc.id} clientConfig={cc} />
                    ))}
                </ItemsList>
            )}
        </>
    );
};
