/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import Alert from "../components/Alert";
import { Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import ConfirmationModal from "../components/ConfirmationModal";
import { SSHPublicKeyValue, UserSSHPublicKeyValue } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";
import dayjs from "dayjs";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";

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
            return false;
        }
        try {
            await getGitpodService().server.addSSHPublicKey(value);
        } catch (e) {
            setErrorMsg(e.message.replace("Request addSSHPublicKey failed with message: ", ""));
            return false;
        }
        props.onClose();
        props.onSave();
        return true;
    };

    return (
        <Modal
            title="New SSH Key"
            buttons={
                <button className="ml-2" onClick={save}>
                    Add SSH Key
                </button>
            }
            visible={true}
            onClose={props.onClose}
            onEnter={save}
        >
            <>
                {errorMsg.length > 0 && (
                    <Alert type="error" className="mb-2">
                        {errorMsg}
                    </Alert>
                )}
            </>
            <div className="text-gray-500 dark:text-gray-400 text-md">
                Add an SSH key for secure access workspaces via SSH.{" "}
                <a href="/docs/configure/ssh" target="gitpod-ssh-doc" className="gp-link">
                    Learn more
                </a>
            </div>
            <Alert type="info" className="mt-2">
                SSH key are used to connect securely to workspaces.{" "}
                <a
                    href="https://www.gitpod.io/docs/configure/ssh#create-an-ssh-key"
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
        </Modal>
    );
}

export function DeleteSSHKeyModal(props: DeleteModalProps) {
    const confirmDelete = async () => {
        await getGitpodService().server.deleteSSHPublicKey(props.value.id!);
        props.onConfirm();
        props.onClose();
    };
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
        <PageWithSettingsSubMenu title="SSH Keys" subtitle="Connect securely to workspaces.">
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
                    <h3>SSH Keys</h3>
                    <h2 className="text-gray-500">Create and manage SSH keys.</h2>
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
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full h-96">
                    <div className="pt-28 flex flex-col items-center w-112 m-auto">
                        <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No SSH Keys</h3>
                        <div className="text-center pb-6 text-gray-500">
                            SSH keys allow you to establish a <b>secure connection</b> between your <b>computer</b> and{" "}
                            <b>workspaces</b>.
                        </div>
                        <button onClick={addOne}>New SSH Key</button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    {dataList.map((key) => {
                        return (
                            <Item solid className="items-start">
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
