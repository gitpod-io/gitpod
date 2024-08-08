/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CreateClientConfigResponse, OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useReducer } from "react";
import { Button } from "@podkit/buttons/Button";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { ssoConfigReducer, isValid, useSaveSSOConfig, SSOConfigForm } from "./SSOConfigForm";
import Alert from "../../components/Alert";
import { LoadingButton } from "@podkit/buttons/LoadingButton";

type Props = {
    clientConfig?: OIDCClientConfig;
    onClose: () => void;
    onSaved: (configId: string) => void;
};

export const OIDCClientConfigModal: FC<Props> = ({ clientConfig, onSaved, onClose }) => {
    const isNew = !clientConfig;

    const [ssoConfig, dispatch] = useReducer(ssoConfigReducer, {
        id: clientConfig?.id ?? "",
        issuer: clientConfig?.oidcConfig?.issuer ?? "",
        clientId: clientConfig?.oauth2Config?.clientId ?? "",
        clientSecret: clientConfig?.oauth2Config?.clientSecret ?? "",
        celExpression: clientConfig?.oauth2Config?.celExpression ?? "",
        usePKCE: clientConfig?.oauth2Config?.usePkce ?? false,
    });
    const configIsValid = isValid(ssoConfig);

    const { save, isLoading, error } = useSaveSSOConfig();

    const saveConfig = useCallback(async () => {
        if (!isValid(ssoConfig) || isLoading) {
            return;
        }

        try {
            // Have to jump through some hoops to ensure we have a config id after create and update
            let configId = ssoConfig.id;

            const resp = await save(ssoConfig);

            // Create response returns the new config, upate does not
            if (resp.hasOwnProperty("config")) {
                configId = (resp as CreateClientConfigResponse).config?.id;
            }

            // There should always be a configId, but just to type-guard
            if (!!configId) {
                onSaved(configId);
            }
            onClose();
        } catch (error) {
            console.error(error);
        }
    }, [isLoading, onClose, onSaved, save, ssoConfig]);

    return (
        <Modal visible onClose={onClose} onSubmit={saveConfig}>
            <ModalHeader>
                {isNew
                    ? "New SSO Configuration"
                    : clientConfig?.active
                    ? "View SSO Configuration"
                    : "Edit SSO Configuration"}
            </ModalHeader>
            <ModalBody>
                {clientConfig?.active && (
                    <Alert type="message" className="mb-4">
                        This configuration is currently active for single sign-on (SSO). To make any modifications,
                        please create a new configuration. Once created, you can proceed to verify and activate it.
                    </Alert>
                )}
                <SSOConfigForm config={ssoConfig} onChange={dispatch} readOnly={clientConfig?.active === true} />
            </ModalBody>
            <ModalFooter alert={error ? <SaveErrorAlert error={error} /> : null}>
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <LoadingButton
                    type="submit"
                    disabled={!configIsValid || clientConfig?.active === true}
                    loading={isLoading}
                >
                    {isNew ? "Create" : "Save"}
                </LoadingButton>
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
