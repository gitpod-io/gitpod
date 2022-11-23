/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import Alert from "../components/Alert";
import TabMenuItem from "../components/TabMenuItem";
import { settingsPathSSHKeys } from "../settings/settings.routes";
import { getGitpodService } from "../service/service";
import { InputWithCopy } from "../components/InputWithCopy";

interface SSHProps {
    workspaceId: string;
    ownerToken: string;
    ideUrl: string;
}

function SSHView(props: SSHProps) {
    const [hasSSHKey, setHasSSHKey] = useState(true);
    const [selectSSHKey, setSelectSSHKey] = useState(true);

    useEffect(() => {
        getGitpodService()
            .server.hasSSHPublicKey()
            .then((d) => {
                setHasSSHKey(d);
            })
            .catch(console.error);
    }, []);

    const host = props.ideUrl.replace(props.workspaceId, props.workspaceId + ".ssh");
    const sshAccessTokenCommand = `ssh '${props.workspaceId}#${props.ownerToken}@${host}'`;
    const sshKeyCommand = `ssh '${props.workspaceId}@${host}'`;

    return (
        <>
            <div className="flex flex-row">
                <TabMenuItem
                    key="ssh_key"
                    name="SSH Key"
                    selected={selectSSHKey}
                    onClick={() => {
                        setSelectSSHKey(true);
                    }}
                />
                <TabMenuItem
                    key="access_token"
                    name="Access Token"
                    selected={!selectSSHKey}
                    onClick={() => {
                        setSelectSSHKey(false);
                    }}
                />
            </div>
            <div className="border-gray-200 dark:border-gray-800 border-b"></div>
            <div className="space-y-4 mt-4">
                {!selectSSHKey && (
                    <Alert type="warning" className="whitespace-normal">
                        <b>Anyone</b> on the internet with this command can access the running workspace. The command
                        includes a generated access token that resets on every workspace restart.
                    </Alert>
                )}
                {!hasSSHKey && selectSSHKey && (
                    <Alert type="warning" className="whitespace-normal">
                        You don't have any public SSH keys in your Gitpod account. You can{" "}
                        <a href={settingsPathSSHKeys} target="setting-keys" className="gp-link">
                            add a new public key
                        </a>
                        , or use a generated access token.
                    </Alert>
                )}

                <p className="text-gray-500 whitespace-normal text-base">
                    {!selectSSHKey ? (
                        "The following shell command can be used to SSH into this workspace."
                    ) : (
                        <>
                            The following shell command can be used to SSH into this workspace with a{" "}
                            <a href={settingsPathSSHKeys} target="setting-keys" className="gp-link">
                                ssh key
                            </a>
                            .
                        </>
                    )}
                </p>
            </div>
            <InputWithCopy
                className="my-2"
                value={!selectSSHKey ? sshAccessTokenCommand : sshKeyCommand}
                tip="Copy SSH Command"
            />
        </>
    );
}

export default function ConnectToSSHModal(props: {
    workspaceId: string;
    ownerToken: string;
    ideUrl: string;
    onClose: () => void;
}) {
    return (
        <Modal
            title="Connect via SSH"
            hideDivider
            buttons={
                <button className={"ml-2 secondary"} onClick={() => props.onClose()}>
                    Close
                </button>
            }
            visible={true}
            onClose={props.onClose}
        >
            <div className="border-gray-200 dark:border-gray-800 -mx-6 px-6 border-b pb-4">
                <SSHView workspaceId={props.workspaceId} ownerToken={props.ownerToken} ideUrl={props.ideUrl} />
            </div>
        </Modal>
    );
}
