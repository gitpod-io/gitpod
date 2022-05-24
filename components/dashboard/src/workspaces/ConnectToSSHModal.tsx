/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import Modal from "../components/Modal";
import Tooltip from "../components/Tooltip";
import copy from "../images/copy.svg";
import AlertBox from "../components/AlertBox";
import InfoBox from "../components/InfoBox";

function InputWithCopy(props: { value: string; tip?: string; className?: string }) {
    const [copied, setCopied] = useState<boolean>(false);
    const copyToClipboard = (text: string) => {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const tip = props.tip ?? "Click to copy";
    return (
        <div className={`w-full relative ${props.className ?? ""}`}>
            <input
                disabled={true}
                readOnly={true}
                autoFocus
                className="w-full pr-8 overscroll-none"
                type="text"
                defaultValue={props.value}
            />
            <div className="cursor-pointer" onClick={() => copyToClipboard(props.value)}>
                <div className="absolute top-1/3 right-3">
                    <Tooltip content={copied ? "Copied" : tip}>
                        <img src={copy} alt="copy icon" title={tip} />
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

interface SSHProps {
    workspaceId: string;
    ownerToken: string;
    ideUrl: string;
}

function SSHView(props: SSHProps) {
    const sshCommand = `ssh ${props.workspaceId}#${props.ownerToken}@${props.ideUrl.replace(
        props.workspaceId,
        props.workspaceId + ".ssh",
    )}`;
    return (
        <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-6">
            <div className="mt-1 mb-4">
                <AlertBox>
                    <p className="text-red-500 whitespace-normal text-base">
                        <b>Anyone</b> on the internet with this command can access the running workspace. The command
                        includes a generated access token that resets on every workspace restart.
                    </p>
                </AlertBox>
                <InfoBox className="mt-4">
                    <p className="text-gray-500 whitespace-normal text-base">
                        Before connecting via SSH, make sure you have an existing SSH private key on your machine. You
                        can create one using&nbsp;
                        <a
                            href="https://en.wikipedia.org/wiki/Ssh-keygen"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gp-link"
                        >
                            ssh-keygen
                        </a>
                        .
                    </p>
                </InfoBox>
                <p className="mt-4 text-gray-500 whitespace-normal text-base">
                    The following shell command can be used to SSH into this workspace.
                </p>
            </div>
            <InputWithCopy value={sshCommand} tip="Copy SSH Command" />
        </div>
    );
}

export default function ConnectToSSHModal(props: {
    workspaceId: string;
    ownerToken: string;
    ideUrl: string;
    onClose: () => void;
}) {
    return (
        // TODO: Use title and buttons props
        <Modal visible={true} onClose={props.onClose}>
            <h3 className="mb-4">Connect via SSH</h3>
            <SSHView workspaceId={props.workspaceId} ownerToken={props.ownerToken} ideUrl={props.ideUrl} />
            <div className="flex justify-end mt-6">
                <button className={"ml-2 secondary"} onClick={() => props.onClose()}>
                    Close
                </button>
            </div>
        </Modal>
    );
}
