/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPageHeader } from "./AdminPageHeader";
import ConfirmationModal from "../components/ConfirmationModal";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { ItemFieldContextMenu } from "../components/ItemsList";
import { ContextMenuEntry } from "../components/ContextMenu";
import Alert from "../components/Alert";
import { SpinnerLoader } from "../components/Loader";
import searchIcon from "../icons/search.svg";
import { Button } from "@podkit/buttons/Button";
import { installationClient } from "../service/public-api";
import { Sort, SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";
import { BlockedRepository, ListBlockedRepositoriesResponse } from "@gitpod/public-api/lib/gitpod/v1/installation_pb";

export function BlockedRepositories() {
    return (
        <AdminPageHeader title="Admin" subtitle="Configure and manage instance settings.">
            <BlockedRepositoriesList />
        </AdminPageHeader>
    );
}

type NewBlockedRepository = Pick<BlockedRepository, "urlRegexp" | "blockUser">;
type ExistingBlockedRepository = Pick<BlockedRepository, "id" | "urlRegexp" | "blockUser">;

interface Props {}

export function BlockedRepositoriesList(props: Props) {
    const [searchResult, setSearchResult] = useState<ListBlockedRepositoriesResponse>(
        new ListBlockedRepositoriesResponse({
            blockedRepositories: [],
        }),
    );
    const [queryTerm, setQueryTerm] = useState("");
    const [searching, setSearching] = useState(false);

    const [isAddModalVisible, setAddModalVisible] = useState(false);
    const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);

    const [currentBlockedRepository, setCurrentBlockedRepository] = useState<BlockedRepository>(
        new BlockedRepository({
            id: 0,
            urlRegexp: "",
            blockUser: false,
        }),
    );

    const search = async () => {
        setSearching(true);
        try {
            const result = await installationClient.listBlockedRepositories({
                // Don't need, added it in json-rpc implement to make life easier.
                // pagination: new PaginationRequest({
                //     token: Buffer.from(JSON.stringify({ offset: 0 })).toString("base64"),
                //     pageSize: 100,
                // }),
                sort: [
                    new Sort({
                        field: "urlRegexp",
                        order: SortOrder.ASC,
                    }),
                ],
                searchTerm: queryTerm,
            });
            setSearchResult(result);
        } finally {
            setSearching(false);
        }
    };
    useEffect(() => {
        search(); // Initial list
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const add = () => {
        setCurrentBlockedRepository(
            new BlockedRepository({
                id: 0,
                urlRegexp: "",
                blockUser: false,
            }),
        );
        setAddModalVisible(true);
    };

    const save = async (blockedRepository: NewBlockedRepository) => {
        await installationClient.createBlockedRepository({
            urlRegexp: blockedRepository.urlRegexp ?? "",
            blockUser: blockedRepository.blockUser ?? false,
        });
        setAddModalVisible(false);
        search();
    };

    const validate = (blockedRepository: NewBlockedRepository): string | undefined => {
        if (blockedRepository.urlRegexp === "") {
            return "Repository URL can not be empty";
        }
    };

    const deleteBlockedRepository = async (blockedRepository: ExistingBlockedRepository) => {
        await installationClient.deleteBlockedRepository({
            blockedRepositoryId: blockedRepository.id,
        });
        search();
    };

    const confirmDeleteBlockedRepository = (blockedRepository: BlockedRepository) => {
        setCurrentBlockedRepository(blockedRepository);
        setAddModalVisible(false);
        setDeleteModalVisible(true);
    };

    return (
        <div className="app-container">
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
                    deleteBlockedRepository={async () => await deleteBlockedRepository(currentBlockedRepository)}
                    onClose={() => setDeleteModalVisible(false)}
                />
            )}
            <div className="pb-3 mt-3 flex">
                <div className="flex justify-between w-full">
                    <div className="flex relative h-10 my-auto">
                        {searching ? (
                            <span className="filter-grayscale absolute top-3 left-3">
                                <SpinnerLoader small={true} />
                            </span>
                        ) : (
                            <img
                                src={searchIcon}
                                title="Search"
                                className="filter-grayscale absolute top-3 left-3"
                                alt="search icon"
                            />
                        )}
                        <input
                            className="w-64 pl-9 border-0"
                            type="search"
                            placeholder="Search by URL RegEx"
                            onKeyDown={(ke) => ke.key === "Enter" && search()}
                            onChange={(v) => {
                                setQueryTerm(v.target.value.trim());
                            }}
                        />
                    </div>
                    <div className="flex space-x-2">
                        <Button onClick={add}>New Blocked Repository</Button>
                    </div>
                </div>
            </div>

            <Alert type={"info"} closable={false} showIcon={true} className="flex rounded p-2 mb-2 w-full">
                Search by repository URL using <abbr title="regular expression">RegEx</abbr>.
            </Alert>
            <div className="flex flex-col space-y-2">
                <div className="px-6 py-3 flex justify-between text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                    <div className="w-9/12">Repository URL (RegEx)</div>
                    <div className="w-1/12">Block Users</div>
                    <div className="w-1/12"></div>
                </div>
                {searchResult.blockedRepositories.map((br) => (
                    <BlockedRepositoryEntry br={br} confirmedDelete={confirmDeleteBlockedRepository} />
                ))}
            </div>
        </div>
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
        <div className="rounded whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-kumquat-light group">
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

    const save = useCallback(() => {
        const v = ref.current;
        const newError = p.validate(v);
        if (!!newError) {
            setError(newError);
        }

        p.save(v);
    }, [p]);

    return (
        <Modal visible onClose={p.onClose} onSubmit={save}>
            <ModalHeader>New Blocked Repository</ModalHeader>
            <ModalBody>
                <Alert type={"warning"} closable={false} showIcon={true} className="flex rounded p-2 w-2/3 mb-2 w-full">
                    Entries in this table have an immediate effect on all users. Please use it carefully.
                </Alert>
                <Alert type={"message"} closable={false} showIcon={true} className="flex rounded p-2 w-2/3 mb-2 w-full">
                    Repositories are blocked by matching their URL against this regular expression.
                </Alert>
                <Details br={br} update={update} error={error} />
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={p.onClose}>
                    Cancel
                </Button>
                <Button type="submit">Add Blocked Repository</Button>
            </ModalFooter>
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
            onConfirm={async () => {
                await props.deleteBlockedRepository();
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
                <div className="bg-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">{props.error}</div>
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

            <CheckboxInputField
                label="Block Users"
                hint="Block any user that tries to open a workspace for a repository URL that matches this RegEx."
                checked={props.br.blockUser}
                disabled={!props.update}
                onChange={(checked) => {
                    if (!!props.update) {
                        props.update({ blockUser: checked });
                    }
                }}
            />
        </div>
    );
}
