/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { InputField } from "../../components/forms/InputField";
import { TextInputField } from "../../components/forms/TextInputField";
import { InputWithCopy } from "../../components/InputWithCopy";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../../components/Modal";
import { useUpsertOIDCClientMutation } from "../../data/oidc-clients/upsert-oidc-client-mutation";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { useOnBlurError } from "../../hooks/use-onblur-error";
import { oidcService } from "../../service/public-api";
import { gitpodHostUrl } from "../../service/service";
import copy from "../images/copy.svg";
import exclamation from "../images/exclamation.svg";

type Props = {
    clientConfig?: OIDCClientConfig;
    onClose: () => void;
};

export const OIDCClientConfigModal: FC<Props> = ({ clientConfig, onClose }) => {
    const { data: org } = useCurrentOrg();
    const upsertClientConfig = useUpsertOIDCClientMutation();

    const isNew = !clientConfig;

    const [issuer, setIssuer] = useState<string>(clientConfig?.oidcConfig?.issuer ?? "");
    const [clientId, setClientId] = useState<string>("");
    const [clientSecret, setClientSecret] = useState<string>("");

    const redirectUrl = gitpodHostUrl.with({ pathname: `/iam/oidc/callback` }).toString();

    const issuerError = useOnBlurError(`Issuer is missing.`, issuer.trim().length > 0);
    const clientIdError = useOnBlurError("Client ID is missing.", clientId.trim().length > 0);
    const clientSecretError = useOnBlurError("Client Secret is missing.", clientSecret.trim().length > 0);

    const isValid = useMemo(
        () => [issuerError, clientIdError, clientSecretError].every((e) => e.isValid),
        [clientIdError, clientSecretError, issuerError],
    );

    const saveConfig = useCallback(async () => {
        if (!org) {
            console.error("no current org selected");
            return;
        }
        if (!isValid) {
            return;
        }

        try {
            upsertClientConfig.mutateAsync({
                config: {
                    organizationId: org.id,
                    oauth2Config: {
                        clientId: clientId,
                        clientSecret: clientSecret,
                    },
                    oidcConfig: {
                        issuer: issuer,
                    },
                },
            });
            onClose();
        } catch (error) {
            console.error(error);
        }
    }, [clientId, clientSecret, isValid, issuer, onClose, org, upsertClientConfig]);

    const errorMessage = upsertClientConfig.isError
        ? (upsertClientConfig.error as Error)?.message || "There was a problem saving your configuration."
        : "";

    return (
        <Modal visible onClose={onClose}>
            <ModalHeader>{isNew ? "New OIDC Client" : "OIDC Client"}</ModalHeader>
            <ModalBody>
                <div className="flex flex-col">
                    <span className="text-gray-500">Enter this information from your OIDC service.</span>
                </div>

                <TextInputField
                    label="Issuer URL"
                    value={issuer}
                    placeholder={"https://accounts.google.com"}
                    // error={hostError}
                    // onBlur={hostOnBlur}
                    onChange={setIssuer}
                />

                <InputField label="Redirect URL">
                    <InputWithCopy value={redirectUrl} tip="Copy the Redirect URL to clipboard" />
                </InputField>

                <TextInputField
                    label="Client ID"
                    value={clientId}
                    // error={clientIdError}
                    // onBlur={clientIdOnBlur}
                    onChange={setClientId}
                />

                <TextInputField
                    label="Client Secret"
                    type="password"
                    value={clientSecret}
                    // error={clientSecretError}
                    // onBlur={clientSecretOnBlur}
                    onChange={setClientSecret}
                />
            </ModalBody>
            <ModalFooter error={errorMessage}>
                <Button onClick={saveConfig} disabled={!isValid} loading={upsertClientConfig.isLoading}>
                    Save
                </Button>
            </ModalFooter>
        </Modal>
    );
};
