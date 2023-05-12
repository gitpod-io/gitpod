/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useReducer } from "react";
import { Button } from "../../components/Button";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { ssoConfigReducer, isValid, useSaveSSOConfig, SSOConfigForm } from "./SSOConfigForm";
import Alert from "../../components/Alert";

type Props = {
    clientConfig?: OIDCClientConfig;
    onClose: () => void;
};

export const OIDCClientConfigModal: FC<Props> = ({ clientConfig, onClose }) => {
    const isNew = !clientConfig;

    const [ssoConfig, dispatch] = useReducer(ssoConfigReducer, {
        id: clientConfig?.id ?? "",
        issuer: clientConfig?.oidcConfig?.issuer ?? "",
        clientId: clientConfig?.oauth2Config?.clientId ?? "",
        clientSecret: clientConfig?.oauth2Config?.clientSecret ?? "",
    });
    const configIsValid = isValid(ssoConfig);

    const { save, isLoading, error } = useSaveSSOConfig();

    const saveConfig = useCallback(async () => {
        if (!isValid(ssoConfig) || isLoading) {
            return;
        }

        try {
            await save(ssoConfig);
            onClose();
        } catch (error) {
            console.error(error);
        }
    }, [isLoading, onClose, save, ssoConfig]);

    return (
        <Modal
            visible
            onClose={onClose}
            onEnter={() => {
                saveConfig();
                return false;
            }}
        >
            <ModalHeader>{isNew ? "New SSO Configuration" : "Edit SSO Configuration"}</ModalHeader>
            <ModalBody>
                {clientConfig?.active && (
                    <Alert type="warning" className="mb-4">
                        This is an active SSO configuration. In order to make changes, please create a new
                        configuration. You may then verify and activate it.
                    </Alert>
                )}
                <SSOConfigForm config={ssoConfig} onChange={dispatch} readOnly={clientConfig?.active === true} />
            </ModalBody>
            <ModalFooter alert={error ? <SaveErrorAlert error={error} /> : null}>
                <Button type="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    onClick={saveConfig}
                    disabled={!configIsValid || clientConfig?.active === true}
                    loading={isLoading}
                >
                    {isNew ? "Create" : "Save"}
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
