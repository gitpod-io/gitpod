/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { EmptyMessage } from "../../components/EmptyMessage";
import { ItemsList } from "../../components/ItemsList";
import { SpinnerLoader } from "../../components/Loader";
import { Heading2, Subheading } from "../../components/typography/headings";
import { useOIDCClientsQuery } from "../../data/oidc-clients/oidc-clients-query";
import { OIDCClientConfigModal } from "./OIDCClientConfigModal";
import { OIDCClientListItem } from "./OIDCClientListItem";

export const SSOClients: FC = () => {
    const { data, isLoading } = useOIDCClientsQuery();

    if (isLoading) {
        return (
            <div>
                <SpinnerLoader />
            </div>
        );
    }

    return <OIDCClients clientConfigs={data || []} />;
};

type OIDCClientsProps = {
    clientConfigs: OIDCClientConfig[];
};
const OIDCClients: FC<OIDCClientsProps> = ({ clientConfigs }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);

    const onCreate = useCallback(() => setShowCreateModal(true), []);
    const hideModal = useCallback(() => setShowCreateModal(false), []);

    return (
        <>
            {showCreateModal && <OIDCClientConfigModal onClose={hideModal} />}

            <Heading2>OpenID Connect clients</Heading2>
            <Subheading>Configure single sign-on for your organization.</Subheading>

            <div className="flex items-start sm:justify-between mb-2">
                {clientConfigs.length !== 0 ? (
                    <div className="mt-3 flex mt-0">
                        <Button onClick={onCreate}>New OIDC Client</Button>
                    </div>
                ) : null}
            </div>

            {clientConfigs.length === 0 && (
                <EmptyMessage
                    title="No OIDC providers"
                    subtitle="Enable single sign-on for your organization using an external identity provider (IdP) service that supports the OpenID Connect (OIDC) standard, such as Google."
                    buttonText="New OIDC Client"
                    onClick={onCreate}
                />
            )}

            <ItemsList className="pt-6">
                {clientConfigs.map((cc) => (
                    <OIDCClientListItem clientConfig={cc} />
                ))}
            </ItemsList>
        </>
    );
};
