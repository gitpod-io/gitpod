/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import Alert from "../components/Alert";
import { Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import ConfirmationModal from "../components/ConfirmationModal";
import { SSHPublicKeyValue, UserSSHPublicKeyValue } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";
import dayjs from "dayjs";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { Heading2, Subheading } from "../components/typography/headings";
import { EmptyMessage } from "../components/EmptyMessage";
import { Button } from "../components/Button";

interface AddModalProps {
    value: SSHPublicKeyValue;
    onClose: () => void;
    onSave: () => void;
}

interface DeleteModalProps {
    value: UserSSHPublicKeyValue;
    onConfirm: () => void;
    onClose: () => void;
}

export function AddSSHKeyModal(props: AddModalProps) {
    const [errorMsg, setErrorMsg] = useState("");

    const [value, setValue] = useState({ ...props.value });
    const update = (pev: Partial<SSHPublicKeyValue>) => {
        setValue({ ...value, ...pev });
        setErrorMsg("");
    };

    useEffect(() => {
        setValue({ ...props.value });
        setErrorMsg("");
    }, [props.value]);

    const save = async () => {
        const tmp = SSHPublicKeyValue.validate(value);
        if (tmp) {
            setErrorMsg(tmp);
            return;
        }
        try {
            await getGitpodService().server.addSSHPublicKey(value);
            props.onClose();
            props.onSave();
        } catch (e) {
            setErrorMsg(e.message.replace("Request addSSHPublicKey failed with message: ", ""));
            return;
        }
    };

    return (
        <Modal visible onClose={props.onClose} onSubmit={save}>
            <ModalHeader>New SSH Key</ModalHeader>
            <ModalBody>
                {errorMsg.length > 0 && (
                    <Alert type="error" className="mb-2">
                        {errorMsg}
                    </Alert>
                )}
                <div className="text-gray-500 dark:text-gray-400 text-md">
                    Add an SSH key for secure access to workspaces via SSH.
                </div>
                <Alert type="info" className="mt-2">
                    SSH key are used to connect securely to workspaces.{" "}
                    <a
                        href="https://www.gitpod.io/docs/configure/user-settings/ssh#create-an-ssh-key"
                        target="gitpod-create-ssh-key-doc"
                        className="gp-link"
                    >
                        Learn how to create an SSH Key
                    </a>
                </Alert>
                <div className="mt-2">
                    <h4>Key</h4>
                    <textarea
                        autoFocus
                        style={{ height: "160px" }}
                        className="w-full resize-none"
                        value={value.key}
                        placeholder="Begins with 'ssh-rsa', 'ecdsa-sha2-nistp256',
                        'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521',
                        'ssh-ed25519',
                        'sk-ecdsa-sha2-nistp256@openssh.com', or
                        'sk-ssh-ed25519@openssh.com'"
                        onChange={(v) => update({ key: v.target.value })}
                    />
                </div>
                <div className="mt-4">
                    <h4>Title</h4>
                    <input
                        className="w-full"
                        type="text"
                        placeholder="e.g. laptop"
                        value={value.name}
                        onChange={(v) => {
                            update({ name: v.target.value });
                        }}
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button type="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <Button htmlType="submit">Add SSH Key</Button>
            </ModalFooter>
        </Modal>
    );
}

export function DeleteSSHKeyModal(props: DeleteModalProps) {
    const confirmDelete = useCallback(async () => {
        await getGitpodService().server.deleteSSHPublicKey(props.value.id!);
        props.onConfirm();
        props.onClose();
    }, [props]);

    return (
        <ConfirmationModal
            title="Delete SSH Key"
            areYouSureText="Are you sure you want to delete this SSH Key?"
            buttonText="Delete SSH Key"
            onClose={props.onClose}
            onConfirm={confirmDelete}
        >
            <Item solid>
                <KeyItem sshKey={props.value}></KeyItem>
            </Item>
        </ConfirmationModal>
    );
}

export default function SSHKeys() {
    const [dataList, setDataList] = useState<UserSSHPublicKeyValue[]>([]);
    const [currentData, setCurrentData] = useState<SSHPublicKeyValue>({ name: "", key: "" });
    const [currentDelData, setCurrentDelData] = useState<UserSSHPublicKeyValue>();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDelModal, setShowDelModal] = useState(false);

    const loadData = () => {
        getGitpodService()
            .server.getSSHPublicKeys()
            .then((r) => setDataList(r));
    };

    useEffect(() => {
        loadData();
    }, []);

    const addOne = () => {
        setCurrentData({ name: "", key: "" });
        setShowAddModal(true);
        setShowDelModal(false);
    };

    const deleteOne = (value: UserSSHPublicKeyValue) => {
        setCurrentDelData(value);
        setShowAddModal(false);
        setShowDelModal(true);
    };

    return (
        <PageWithSettingsSubMenu>
            {showAddModal && (
                <AddSSHKeyModal value={currentData} onSave={loadData} onClose={() => setShowAddModal(false)} />
            )}
            {showDelModal && (
                <DeleteSSHKeyModal
                    value={currentDelData!}
                    onConfirm={loadData}
                    onClose={() => setShowDelModal(false)}
                />
            )}
            <div className="flex items-start sm:justify-between mb-2">
                <div>
                    <Heading2>SSH Keys</Heading2>
                    <Subheading>
                        Create and manage SSH keys.{" "}
                        <a
                            className="gp-link"
                            href="https://www.gitpod.io/docs/configure/user-settings/ssh"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Learn more
                        </a>
                    </Subheading>
                </div>
                {dataList.length !== 0 ? (
                    <div className="mt-3 flex">
                        <button onClick={addOne} className="ml-2">
                            New SSH Key
                        </button>
                    </div>
                ) : null}
            </div>
            {dataList.length === 0 ? (
                <EmptyMessage
                    title="No SSH Keys"
                    subtitle={
                        <span>
                            SSH keys allow you to establish a <b>secure connection</b> between your <b>computer</b> and{" "}
                            <b>workspaces</b>.
                        </span>
                    }
                    buttonText="New SSH Key"
                    onClick={addOne}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    {dataList.map((key) => {
                        return (
                            <Item key={key.id} solid className="items-start">
                                <KeyItem sshKey={key}></KeyItem>
                                <ItemFieldContextMenu
                                    position="start"
                                    menuEntries={[
                                        {
                                            title: "Delete",
                                            customFontStyle:
                                                "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                            onClick: () => deleteOne(key),
                                        },
                                    ]}
                                />
                            </Item>
                        );
                    })}
                </div>
            )}
        </PageWithSettingsSubMenu>
    );
}

function KeyItem(props: { sshKey: UserSSHPublicKeyValue }) {
    const key = props.sshKey;
    return (
        <ItemField className="flex flex-col gap-y box-border overflow-hidden">
            <p className="truncate text-gray-400 dark:text-gray-600">SHA256:{key.fingerprint}</p>
            <div className="truncate my-1 text-xl text-gray-800 dark:text-gray-100 font-semibold">{key.name}</div>
            <p className="truncate mt-4">Added on {dayjs(key.creationTime).format("MMM D, YYYY, hh:mm A")}</p>
            {!!key.lastUsedTime && (
                <p className="truncate">Last used on {dayjs(key.lastUsedTime).format("MMM D, YYYY, hh:mm A")}</p>
            )}
        </ItemField>
    );
}
