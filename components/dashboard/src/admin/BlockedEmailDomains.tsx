/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EmailDomainFilterEntry } from "@gitpod/gitpod-protocol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "../components/Alert";
import { ContextMenuEntry } from "../components/ContextMenu";
import { ItemFieldContextMenu } from "../components/ItemsList";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import searchIcon from "../icons/search.svg";
import { AdminPageHeader } from "./AdminPageHeader";
import Pagination from "../Pagination/Pagination";
import { Button } from "@podkit/buttons/Button";
import { installationClient } from "../service/public-api";
import { ListBlockedEmailDomainsResponse } from "@gitpod/public-api/lib/gitpod/v1/installation_pb";

export function BlockedEmailDomains() {
    return (
        <AdminPageHeader title="Admin" subtitle="Block email domains.">
            <BlockedEmailDomainsList />
        </AdminPageHeader>
    );
}

function useBlockedEmailDomains() {
    return useQuery(["blockedEmailDomains"], () => installationClient.listBlockedEmailDomains({}), {
        staleTime: 1000 * 60 * 5, // 5min
    });
}

function useUpdateBlockedEmailDomainMutation() {
    const queryClient = useQueryClient();
    const blockedEmailDomains = useBlockedEmailDomains();
    return useMutation(
        async (blockedDomain: EmailDomainFilterEntry) => {
            await installationClient.createBlockedEmailDomain({
                domain: blockedDomain.domain,
                negative: blockedDomain.negative ?? false,
            });
        },
        {
            onSuccess: (_, blockedDomain) => {
                const data = new ListBlockedEmailDomainsResponse(blockedEmailDomains.data);
                data.blockedEmailDomains.map((entry) => {
                    if (entry.domain !== blockedDomain.domain) {
                        return entry;
                    }
                    return blockedDomain;
                });
                queryClient.setQueryData(["blockedEmailDomains"], data);
                blockedEmailDomains.refetch();
            },
        },
    );
}

interface Props {}

export function BlockedEmailDomainsList(props: Props) {
    const blockedEmailDomains = useBlockedEmailDomains();
    const updateBlockedEmailDomainMutation = useUpdateBlockedEmailDomainMutation();
    const [searchTerm, setSearchTerm] = useState("");
    const pageSize = 50;
    const [isAddModalVisible, setAddModalVisible] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentBlockedDomain, setCurrentBlockedDomain] = useState<EmailDomainFilterEntry>({
        domain: "",
        negative: false,
    });

    const searchResult = useMemo(() => {
        if (!blockedEmailDomains.data) {
            return [];
        }
        return blockedEmailDomains.data.blockedEmailDomains.filter((entry) =>
            entry.domain.toLowerCase().includes(searchTerm.toLowerCase()),
        );
    }, [blockedEmailDomains.data, searchTerm]);

    const add = () => {
        setCurrentBlockedDomain({
            domain: "",
            negative: false,
        });
        setAddModalVisible(true);
    };

    const save = async (blockedDomain: EmailDomainFilterEntry) => {
        updateBlockedEmailDomainMutation.mutateAsync(blockedDomain);
        setAddModalVisible(false);
    };

    const validate = (blockedDomain: EmailDomainFilterEntry): string | undefined => {
        if (blockedDomain.domain === "" || blockedDomain.domain.trim() === "%") {
            return "Domain can not be empty";
        }
    };

    return (
        <div className="app-container">
            {isAddModalVisible && (
                <AddBlockedDomainModal
                    blockedDomain={currentBlockedDomain}
                    validate={validate}
                    save={save}
                    onClose={() => setAddModalVisible(false)}
                />
            )}
            <div className="pb-3 mt-3 flex">
                <div className="flex justify-between w-full">
                    <div className="flex relative h-10 my-auto">
                        <img
                            src={searchIcon}
                            title="Search"
                            className="filter-grayscale absolute top-3 left-3"
                            alt="search icon"
                        />
                        <input
                            className="w-64 pl-9 border-0"
                            type="search"
                            placeholder="Search by domain"
                            onChange={(v) => {
                                setSearchTerm(v.target.value.trim());
                            }}
                        />
                    </div>
                    <div className="flex space-x-2">
                        <Button onClick={add}>Add Domain</Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col space-y-2">
                <div className="px-6 py-3 flex justify-between text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                    <div className="w-9/12">Domain</div>
                    <div className="w-1/12">Block Users</div>
                    <div className="w-1/12"></div>
                </div>
                {searchResult.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((br) => (
                    <BlockedDomainEntry
                        key={br.domain}
                        br={br}
                        toggleBlockUser={async () => {
                            br.negative = !br.negative;
                            updateBlockedEmailDomainMutation.mutateAsync(br);
                        }}
                    />
                ))}
                <Pagination
                    currentPage={currentPage}
                    setPage={setCurrentPage}
                    totalNumberOfPages={Math.ceil(searchResult.length / pageSize)}
                />
            </div>
        </div>
    );
}

function BlockedDomainEntry(props: {
    br: EmailDomainFilterEntry;
    toggleBlockUser: (br: EmailDomainFilterEntry) => void;
}) {
    const menuEntries: ContextMenuEntry[] = [
        {
            title: "Toggle Block User",
            onClick: () => props.toggleBlockUser(props.br),
            customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
        },
    ];
    return (
        <div className="rounded whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-kumquat-light group">
            <div className="flex flex-col w-9/12 truncate">
                <span className="mr-3 text-lg text-gray-600 truncate">{props.br.domain}</span>
            </div>
            <div className="flex flex-col self-center w-1/12">
                <span className="mr-3 text-lg text-gray-600 truncate">{props.br.negative ? "Yes" : "No"}</span>
            </div>
            <div className="flex flex-col w-1/12">
                <ItemFieldContextMenu menuEntries={menuEntries} />
            </div>
        </div>
    );
}

interface AddBlockedDomainModalProps {
    blockedDomain: EmailDomainFilterEntry;
    validate: (blockedDomain: EmailDomainFilterEntry) => string | undefined;
    save: (br: EmailDomainFilterEntry) => void;
    onClose: () => void;
}

function AddBlockedDomainModal(p: AddBlockedDomainModalProps) {
    const [br, setBr] = useState({ ...p.blockedDomain });
    const [error, setError] = useState("");
    const ref = useRef(br);

    const update = (previous: Partial<EmailDomainFilterEntry>) => {
        const newEnv = { ...ref.current, ...previous };
        setBr(newEnv);
        ref.current = newEnv;
    };

    useEffect(() => {
        setBr({ ...p.blockedDomain });
        setError("");
    }, [p.blockedDomain]);

    const save = () => {
        const v = ref.current;
        const newError = p.validate(v);
        if (!!newError) {
            setError(newError);
        }

        p.save(v);
        p.onClose();
    };

    return (
        <Modal visible={true} onClose={p.onClose} onSubmit={save}>
            <ModalHeader>New Blocked Domain</ModalHeader>
            <ModalBody>
                <Alert type={"warning"} closable={false} showIcon={true} className="flex rounded p-2 w-2/3 mb-2 w-full">
                    Entries in this table have an immediate effect on all new users. Please use it carefully.
                </Alert>
                <Alert type={"message"} closable={false} showIcon={true} className="flex rounded p-2 w-2/3 mb-2 w-full">
                    Users are blocked by matching their email domain.
                </Alert>
                <Details br={br} update={update} error={error} />
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={p.onClose}>
                    Cancel
                </Button>
                <Button type="submit">Add Blocked Domain</Button>
            </ModalFooter>
        </Modal>
    );
}

function Details(props: {
    br: EmailDomainFilterEntry;
    error?: string;
    update?: (pev: Partial<EmailDomainFilterEntry>) => void;
}) {
    return (
        <div className="border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
            {props.error ? (
                <div className="bg-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">{props.error}</div>
            ) : null}
            <div>
                <h4>Domain (may contain '%' as wild card)</h4>
                <input
                    autoFocus
                    className="w-full"
                    type="text"
                    value={props.br.domain}
                    placeholder={'e.g. "mailicous-domain.com"'}
                    disabled={!props.update}
                    onChange={(v) => {
                        if (!!props.update) {
                            props.update({ domain: v.target.value });
                        }
                    }}
                />
            </div>

            <CheckboxInputField
                label="Block Users"
                hint="Block any user that tries to sign up with this email domain."
                checked={props.br.negative}
                disabled={!props.update}
                onChange={(checked) => {
                    if (!!props.update) {
                        props.update({ negative: checked });
                    }
                }}
            />
        </div>
    );
}
