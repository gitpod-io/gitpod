/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdminGetListResult } from "@gitpod/gitpod-protocol";
import { useEffect, useRef, useState } from "react";
import { getGitpodService } from "../service/service";
import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import ConfirmationModal from "../components/ConfirmationModal";
import Modal from "../components/Modal";
import CheckBox from "../components/CheckBox";
import { ItemFieldContextMenu } from "../components/ItemsList";
import { ContextMenuEntry } from "../components/ContextMenu";
import Alert from "../components/Alert";

export function BlockedRepositories() {
    return (
        <PageWithAdminSubMenu title="Blocked Repositories" subtitle="Search and manage all blocked repositories.">
            <BlockedRepositoriesList />
        </PageWithAdminSubMenu>
    );
}

type NewBlockedRepository = Pick<BlockedRepository, "urlRegexp" | "blockUser">;
type ExistingBlockedRepository = Pick<BlockedRepository, "id" | "urlRegexp" | "blockUser">;

interface Props {}

export function BlockedRepositoriesList(props: Props) {
    const [searchResult, setSearchResult] = useState<AdminGetListResult<BlockedRepository>>({ rows: [], total: 0 });
    const [queryTerm, setQueryTerm] = useState("");
    const [searching, setSearching] = useState(false);

    const [isAddModalVisible, setAddModalVisible] = useState(false);
    const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);

    const [currentBlockedRepository, setCurrentBlockedRepository] = useState<ExistingBlockedRepository>({
        id: 0,
        urlRegexp: "",
        blockUser: false,
    });

    const search = async () => {
        setSearching(true);
        try {
            const result = await getGitpodService().server.adminGetBlockedRepositories({
                limit: 100,
                orderBy: "urlRegexp",
                offset: 0,
                orderDir: "asc",
                searchTerm: queryTerm,
            });
            setSearchResult(result);
        } finally {
            setSearching(false);
        }
    };
    useEffect(() => {
        search(); // Initial list
    }, []);

    const add = () => {
        setCurrentBlockedRepository({
            id: 0,
            urlRegexp: "",
            blockUser: false,
        });
        setAddModalVisible(true);
    };

    const save = async (blockedRepository: NewBlockedRepository) => {
        await getGitpodService().server.adminCreateBlockedRepository(
            blockedRepository.urlRegexp,
            blockedRepository.blockUser,
        );
        setAddModalVisible(false);
        search();
    };

    const validate = (blockedRepository: NewBlockedRepository): string | undefined => {
        if (blockedRepository.urlRegexp === "") {
            return "Repository URL can not be empty";
        }
    };

    const deleteBlockedRepository = async (blockedRepository: ExistingBlockedRepository) => {
        await getGitpodService().server.adminDeleteBlockedRepository(blockedRepository.id);
        search();
    };

    const confirmDeleteBlockedRepository = (blockedRepository: ExistingBlockedRepository) => {
        setCurrentBlockedRepository(blockedRepository);
        setAddModalVisible(false);
        setDeleteModalVisible(true);
    };

    return (
        <>
            {isAddModalVisible && (
                <AddBlockedRepositoryModal
                    blockedRepository={currentBlockedRepository}
                    validate={validate}
                    save={save}
                    onClose={() => setAddModalVisible(false)}
                />
            )}
            {isDeleteModalVisible && (
                <DeleteBlockedRepositoryModal
                    blockedRepository={currentBlockedRepository}
                    deleteBlockedRepository={() => deleteBlockedRepository(currentBlockedRepository)}
                    onClose={() => setDeleteModalVisible(false)}
                />
            )}
            <div className="pt-8 flex">
                <div className="flex justify-between w-full">
                    <div className="flex">
                        <div className="py-4">
                            {searching ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        fill="#A8A29E"
                                        d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
                                    >
                                        <animateTransform
                                            attributeName="transform"
                                            type="rotate"
                                            dur="0.75s"
                                            values="0 12 12;360 12 12"
                                            repeatCount="indefinite"
                                        />
                                    </path>
                                </svg>
                            ) : (
                                <svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                                        fill="#A8A29E"
                                    />
                                </svg>
                            )}
                        </div>
                        <input
                            type="search"
                            placeholder="Search by URL RegEx"
                            onKeyDown={(ke) => ke.key === "Enter" && search()}
                            onChange={(v) => {
                                setQueryTerm(v.target.value.trim());
                            }}
                        />
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={add}>New Blocked Repository</button>
                    </div>
                </div>
            </div>

            <Alert type={"info"} closable={false} showIcon={true} className="flex rounded p-2 mb-2 w-full">
                Search entries by their repository URL <abbr title="regular expression">RegEx</abbr>.
            </Alert>
            <div className="flex flex-col space-y-2">
                <div className="px-6 py-3 flex justify-between text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                    <div className="w-9/12">Repository URL (RegEx)</div>
                    <div className="w-1/12">Block Users</div>
                    <div className="w-1/12"></div>
                </div>
                {searchResult.rows.map((br) => (
                    <BlockedRepositoryEntry br={br} confirmedDelete={confirmDeleteBlockedRepository} />
                ))}
            </div>
        </>
    );
}

function BlockedRepositoryEntry(props: { br: BlockedRepository; confirmedDelete: (br: BlockedRepository) => void }) {
    const menuEntries: ContextMenuEntry[] = [
        {
            title: "Delete",
            onClick: () => props.confirmedDelete(props.br),
            customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
        },
    ];
    return (
        <div className="rounded whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
            <div className="flex flex-col w-9/12 truncate">
                <span className="mr-3 text-lg text-gray-600 truncate">{props.br.urlRegexp}</span>
            </div>
            <div className="flex flex-col self-center w-1/12">
                <span className="mr-3 text-lg text-gray-600 truncate">{props.br.blockUser ? "Yes" : "No"}</span>
            </div>
            <div className="flex flex-col w-1/12">
                <ItemFieldContextMenu menuEntries={menuEntries} />
            </div>
        </div>
    );
}

interface AddBlockedRepositoryModalProps {
    blockedRepository: NewBlockedRepository;
    validate: (blockedRepository: NewBlockedRepository) => string | undefined;
    save: (br: NewBlockedRepository) => void;
    onClose: () => void;
}

function AddBlockedRepositoryModal(p: AddBlockedRepositoryModalProps) {
    const [br, setBr] = useState({ ...p.blockedRepository });
    const [error, setError] = useState("");
    const ref = useRef(br);

    const update = (previous: Partial<NewBlockedRepository>) => {
        const newEnv = { ...ref.current, ...previous };
        setBr(newEnv);
        ref.current = newEnv;
    };

    useEffect(() => {
        setBr({ ...p.blockedRepository });
        setError("");
    }, [p.blockedRepository]);

    const save = (): boolean => {
        const v = ref.current;
        const newError = p.validate(v);
        if (!!newError) {
            setError(newError);
            return false;
        }

        p.save(v);
        p.onClose();
        return true;
    };

    return (
        <Modal
            visible={true}
            title={"New Blocked Repository"}
            onClose={p.onClose}
            onEnter={save}
            buttons={[
                <button className="secondary" onClick={p.onClose}>
                    Cancel
                </button>,
                <button className="ml-2" onClick={save}>
                    Add Blocked Repository
                </button>,
            ]}
        >
            <Alert type={"warning"} closable={false} showIcon={true} className="flex rounded p-2 w-2/3 mb-2 w-full">
                Entries in this table have an immediate effect on all users. Please use it carefully.
            </Alert>
            <Alert type={"message"} closable={false} showIcon={true} className="flex rounded p-2 w-2/3 mb-2 w-full">
                Repositories are blocked by matching their URL against this regular expression.
            </Alert>
            <Details br={br} update={update} error={error} />
        </Modal>
    );
}

function DeleteBlockedRepositoryModal(props: {
    blockedRepository: ExistingBlockedRepository;
    deleteBlockedRepository: () => void;
    onClose: () => void;
}) {
    return (
        <ConfirmationModal
            title="Delete Blocked Repository"
            areYouSureText="Are you sure you want to delete this repository from the list?"
            buttonText="Delete Blocked Repository"
            onClose={props.onClose}
            onConfirm={() => {
                props.deleteBlockedRepository();
                props.onClose();
            }}
        >
            <Details br={props.blockedRepository} />
        </ConfirmationModal>
    );
}

function Details(props: {
    br: NewBlockedRepository;
    error?: string;
    update?: (pev: Partial<NewBlockedRepository>) => void;
}) {
    return (
        <div className="border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
            {props.error ? (
                <div className="bg-gitpod-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">{props.error}</div>
            ) : null}
            <div>
                <h4>Repository URL RegEx</h4>
                <input
                    autoFocus
                    className="w-full"
                    type="text"
                    value={props.br.urlRegexp}
                    placeholder={'e.g. "https://github.com/malicious-user/*"'}
                    disabled={!props.update}
                    onChange={(v) => {
                        if (!!props.update) {
                            props.update({ urlRegexp: v.target.value });
                        }
                    }}
                />
            </div>
            <CheckBox
                title={"Block Users"}
                desc={"Block any user that tries to open a workspace for a repository URL that matches this RegEx."}
                checked={props.br.blockUser}
                disabled={!props.update}
                onChange={(v) => {
                    if (!!props.update) {
                        props.update({ blockUser: v.target.checked });
                    }
                }}
            />
        </div>
    );
}
