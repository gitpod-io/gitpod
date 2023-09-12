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
import { useToast } from "../../components/toasts/Toasts";
import { LinkButton } from "../../components/LinkButton";
import { ActivateConfigModal } from "./ActivateConfigModal";
import { useVerifyClient } from "./use-verify-client";

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
    const { toast } = useToast();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activateModalConfigId, setActivateModalConfigID] = useState("");

    const verifyClient = useVerifyClient({
        onSuccess: (configId: string) => {
            toast(
                <span>
                    Single sign-on configuration was successfully verified.{" "}
                    <LinkButton inverted onClick={() => setActivateModalConfigID(configId)}>
                        Activate configuration
                    </LinkButton>
                </span>,
            );
        },
        onError: (errorMessage) => {
            toast(errorMessage);
        },
    });

    const onCreate = useCallback(() => setShowCreateModal(true), []);
    const hideModal = useCallback(() => setShowCreateModal(false), []);

    const handleSaved = useCallback(
        (configId: string) => {
            toast(
                <span>
                    Single sign-on configuration was successfully saved.{" "}
                    <LinkButton inverted onClick={() => verifyClient(configId)}>
                        Verify configuration
                    </LinkButton>
                </span>,
            );
        },
        [toast, verifyClient],
    );

    const hasActiveConfig = clientConfigs.some((config) => config.active);

    return (
        <>
            {showCreateModal && <OIDCClientConfigModal onSaved={handleSaved} onClose={hideModal} />}

            <div className="flex flex-col space-y-2 md:flex-row md:items-start md:justify-between md:space-y-0">
                <div>
                    <Heading2>SSO Configurations</Heading2>
                    <Subheading>Configure OpenID Connect single sign-on for your organization.</Subheading>
                </div>

                {clientConfigs.length !== 0 ? (
                    <div>
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
                        <OIDCClientListItem
                            key={cc.id}
                            clientConfig={cc}
                            hasActiveConfig={hasActiveConfig}
                            onVerify={verifyClient}
                            onActivate={setActivateModalConfigID}
                            onSaved={handleSaved}
                        />
                    ))}
                </ItemsList>
            )}

            {!!activateModalConfigId && (
                <ActivateConfigModal
                    configId={activateModalConfigId}
                    hasActiveConfig={hasActiveConfig}
                    onClose={() => setActivateModalConfigID("")}
                />
            )}
        </>
    );
};
