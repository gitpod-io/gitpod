/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { EmptyMessage } from "../../components/EmptyMessage";
import { Item, ItemField, ItemFieldIcon, ItemsList } from "../../components/ItemsList";
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

            <div className="flex flex-col space-y-2 md:flex-row md:items-start md:justify-between md:space-y-0">
                <div>
                    <Heading2>SSO Configurations</Heading2>
                    <Subheading>Configure OpenID Connect single sign-on for your organization.</Subheading>
                </div>

                {clientConfigs.length !== 0 ? (
                    <div className="">
                        <Button className="whitespace-nowrap" onClick={onCreate}>
                            New Configuration
                        </Button>
                    </div>
                ) : null}
            </div>

            {clientConfigs.length === 0 ? (
                <EmptyMessage
                    subtitle="Enable single sign-on for your organization using an external identity provider (IdP) service that supports the OpenID Connect (OIDC) standard, such as Google or Okta."
                    buttonText="New Configuration"
                    onClick={onCreate}
                />
            ) : (
                <ItemsList className="pt-6">
                    <Item header={true}>
                        <ItemFieldIcon />
                        <ItemField>Issuer URL</ItemField>
                    </Item>
                    {clientConfigs.map((cc) => (
                        <OIDCClientListItem key={cc.id} clientConfig={cc} />
                    ))}
                </ItemsList>
            )}
        </>
    );
};
