/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import Alert from "../components/Alert";
import { settingsPathSSHKeys } from "../user-settings/settings.routes";
import { InputWithCopy } from "../components/InputWithCopy";
import { Link } from "react-router-dom";
import { Button } from "@podkit/buttons/Button";
import { sshClient } from "../service/public-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@podkit/tabs/Tabs";

interface SSHProps {
    workspaceId: string;
    ownerToken: string;
    ideUrl: string;
}

function SSHView(props: SSHProps) {
    const [hasSSHKey, setHasSSHKey] = useState(true);

    useEffect(() => {
        sshClient
            .listSSHPublicKeys({})
            .then((r) => {
                setHasSSHKey(r.sshKeys.length > 0);
            })
            .catch(console.error);
    }, []);

    const host = props.ideUrl.replace(props.workspaceId, props.workspaceId + ".ssh");
    const sshAccessTokenCommand = `ssh '${props.workspaceId}#${props.ownerToken}@${host}'`;
    const sshKeyCommand = `ssh '${props.workspaceId}@${host}'`;

    return (
        <>
            <Tabs defaultValue="ssh_key">
                <TabsList className="flex flex-row items-start">
                    <TabsTrigger value="ssh_key" className="text-base">
                        {" "}
                        SSH Key{" "}
                    </TabsTrigger>
                    <TabsTrigger value="access_token" className="text-base">
                        Access Token
                    </TabsTrigger>
                </TabsList>
                <div className="border-gray-200 dark:border-gray-800 pt-1 border-b"></div>
                <TabsContent value="ssh_key" className="space-y-4 mt-4">
                    {!hasSSHKey && (
                        <Alert type="warning" className="whitespace-normal">
                            You don't have any public SSH keys in your Gitpod account. You can{" "}
                            <Link to={settingsPathSSHKeys} className="gp-link">
                                add a new public key
                            </Link>
                            , or use a generated access token.
                        </Alert>
                    )}

                    <p className="text-gray-500 whitespace-normal text-base">
                        <span>
                            The following shell command can be used to SSH into this workspace with an{" "}
                            <Link to={settingsPathSSHKeys} className="gp-link">
                                SSH key
                            </Link>
                            .
                        </span>
                    </p>
                    <InputWithCopy className="my-2" value={sshKeyCommand} tip="Copy SSH Command" />
                </TabsContent>
                <TabsContent value="access_token" className="space-y-4 mt-4">
                    <Alert type="warning" className="whitespace-normal">
                        <b>Anyone</b> on the internet with this command can access the running workspace. The command
                        includes a generated access token that resets on every workspace restart.
                    </Alert>
                    <p className="text-gray-500 whitespace-normal text-base">
                        The following shell command can be used to SSH into this workspace.
                    </p>
                    <InputWithCopy className="my-2" value={sshAccessTokenCommand} tip="Copy SSH Command" />
                </TabsContent>
            </Tabs>
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
        <Modal hideDivider visible onClose={props.onClose}>
            <ModalHeader>Connect via SSH</ModalHeader>
            <ModalBody>
                <SSHView workspaceId={props.workspaceId} ownerToken={props.ownerToken} ideUrl={props.ideUrl} />
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={() => props.onClose()}>
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}
