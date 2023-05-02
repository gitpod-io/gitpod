/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useMemo, useState } from "react";
import isURL from "validator/lib/isURL";
import { Button } from "../../components/Button";
import { InputField } from "../../components/forms/InputField";
import { TextInputField } from "../../components/forms/TextInputField";
import { InputWithCopy } from "../../components/InputWithCopy";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { useUpsertOIDCClientMutation } from "../../data/oidc-clients/upsert-oidc-client-mutation";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { useOnBlurError } from "../../hooks/use-onblur-error";
import { gitpodHostUrl } from "../../service/service";

type Props = {
    clientConfig?: OIDCClientConfig;
    onClose: () => void;
};

export const OIDCClientConfigModal: FC<Props> = ({ clientConfig, onClose }) => {
    const { data: org } = useCurrentOrg();
    const upsertClientConfig = useUpsertOIDCClientMutation();

    const isNew = !clientConfig;

    const [issuer, setIssuer] = useState(clientConfig?.oidcConfig?.issuer ?? "");
    const [clientId, setClientId] = useState(clientConfig?.oauth2Config?.clientId ?? "");
    const [clientSecret, setClientSecret] = useState(clientConfig?.oauth2Config?.clientSecret ?? "");

    const redirectUrl = gitpodHostUrl.with({ pathname: `/iam/oidc/callback` }).toString();

    const issuerError = useOnBlurError(`Please enter a valid URL.`, issuer.trim().length > 0 && isURL(issuer));
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

        const trimmedIssuer = issuer.trim();
        const trimmedClientId = clientId.trim();
        const trimmedClientSecret = clientSecret.trim();

        try {
            await upsertClientConfig.mutateAsync({
                config: isNew
                    ? {
                          organizationId: org.id,
                          oauth2Config: {
                              clientId: trimmedClientId,
                              clientSecret: trimmedClientSecret,
                          },
                          oidcConfig: {
                              issuer: trimmedIssuer,
                          },
                      }
                    : {
                          id: clientConfig?.id,
                          organizationId: org.id,
                          oauth2Config: {
                              clientId: trimmedClientId,
                              // TODO: determine how we should handle when user doesn't change their secret
                              clientSecret: clientSecret === "redacted" ? "" : trimmedClientSecret,
                          },
                          oidcConfig: {
                              issuer: trimmedIssuer,
                          },
                      },
            });

            onClose();
        } catch (error) {
            console.error(error);
        }
    }, [clientConfig?.id, clientId, clientSecret, isNew, isValid, issuer, onClose, org, upsertClientConfig]);

    return (
        <Modal
            visible
            onClose={onClose}
            onEnter={() => {
                saveConfig();
                return false;
            }}
        >
            <ModalHeader>{isNew ? "New OIDC Client" : "OIDC Client"}</ModalHeader>
            <ModalBody>
                <div className="flex flex-col">
                    <span className="text-gray-500">Enter this information from your OIDC service.</span>
                </div>

                <TextInputField
                    label="Issuer URL"
                    value={issuer}
                    placeholder={"https://accounts.google.com"}
                    error={issuerError.message}
                    onBlur={issuerError.onBlur}
                    onChange={setIssuer}
                />

                <InputField label="Redirect URL">
                    <InputWithCopy value={redirectUrl} tip="Copy the Redirect URL to clipboard" />
                </InputField>

                <TextInputField
                    label="Client ID"
                    value={clientId}
                    error={clientIdError.message}
                    onBlur={clientIdError.onBlur}
                    onChange={setClientId}
                />

                <TextInputField
                    label="Client Secret"
                    type="password"
                    value={clientSecret}
                    error={clientSecretError.message}
                    onBlur={clientSecretError.onBlur}
                    onChange={setClientSecret}
                />
            </ModalBody>
            <ModalFooter
                alert={upsertClientConfig.isError ? <SaveErrorAlert error={upsertClientConfig.error as Error} /> : null}
            >
                <Button type="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button onClick={saveConfig} disabled={!isValid} loading={upsertClientConfig.isLoading}>
                    Save
                </Button>
            </ModalFooter>
        </Modal>
    );
};

type SaveErrorMessageProps = {
    error?: Error;
};
const SaveErrorAlert: FC<SaveErrorMessageProps> = ({ error }) => {
    const message = error?.message || "";

    return (
        <ModalFooterAlert type="danger">
            <span>There was a problem saving your configuration.</span>
            {message && <div className="leading-4 text-xs font-mono">{message}</div>}
        </ModalFooterAlert>
    );
};
