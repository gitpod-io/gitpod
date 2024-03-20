/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo, useState } from "react";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Button } from "@podkit/buttons/Button";
import { SwitchInputField } from "@podkit/switch/Switch";
import { PinIcon } from "lucide-react";
import { cn } from "@podkit/lib/cn";
import { UseMutationResult } from "@tanstack/react-query";
import { MiddleDot } from "./typography/MiddleDot";
import { useToast } from "./toasts/Toasts";
import Modal, { ModalBaseFooter, ModalBody, ModalHeader } from "./Modal";
import { LoadingState } from "@podkit/loading/LoadingState";
import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { useFeatureFlag } from "../data/featureflag-query";
import { useIDEVersionsQuery } from "../data/ide-options/ide-options-query";

interface IdeOptionsProps {
    ideOptions: IDEOptions | undefined;
    pinnedEditorVersions: Map<string, string>;
    className?: string;
    emptyState?: React.ReactNode;
    isLoading?: boolean;
}

export const IdeOptions = (props: IdeOptionsProps) => {
    if (props.isLoading) {
        return <LoadingState />;
    }
    return (
        <div className={cn("space-y-2", props.className)}>
            {sortedIdeOptions(props.ideOptions!).map((ide) => (
                <div key={ide.id} className="flex gap-2 items-center">
                    <img className="w-8 h-8 self-center" src={ide.logo} alt="" />
                    <span>
                        <span className="font-medium text-pk-content-primary">{ide.title}</span>
                        {ide.imageVersion && (
                            <>
                                <MiddleDot />
                                {props.pinnedEditorVersions.get(ide.id) && (
                                    <PinIcon size={16} className="inline align-text-bottom" />
                                )}
                                <span className="text-pk-content-primary">
                                    {props.pinnedEditorVersions.get(ide.id) || ide.imageVersion}
                                </span>
                            </>
                        )}
                        <MiddleDot />
                        <span className="text-pk-content-primary capitalize">{ide.type}</span>
                    </span>
                </div>
            ))}
        </div>
    );
};

export interface IdeOptionsModifyModalProps {
    isLoading: boolean;
    ideOptions: IDEOptions | undefined;
    restrictedEditors: Set<string>;
    pinnedEditorVersions: Map<string, string>;
    updateMutation: UseMutationResult<
        void,
        Error,
        { restrictedEditors: Set<string>; pinnedEditorVersions: Map<string, string> }
    >;
    onClose: () => void;
}

export const IdeOptionsModifyModal = ({
    onClose,
    updateMutation,
    ideOptions,
    ...props
}: IdeOptionsModifyModalProps) => {
    const orgLevelEditorVersionPinningEnabled = useFeatureFlag("org_level_editor_version_pinning_enabled");

    const ideOptionsArr = useMemo(() => (ideOptions ? sortedIdeOptions(ideOptions) : undefined), [ideOptions]);
    const pinnableIdes = useMemo(
        () => ideOptionsArr?.filter((i) => orgLevelEditorVersionPinningEnabled && !!i.pinnable),
        [ideOptionsArr, orgLevelEditorVersionPinningEnabled],
    );

    const [restrictedEditors, setEditors] = useState(props.restrictedEditors);
    const [pinnedEditorVersions, setPinnedEditorVersions] = useState(props.pinnedEditorVersions);
    const {
        data: editorVersions,
        isLoading: isLoadingEditorVersions,
        ...editorVersionsQuery
    } = useIDEVersionsQuery(pinnableIdes?.map((e) => e.id));

    const { toast } = useToast();

    const handleUpdate = async () => {
        if (computedError) {
            return;
        }
        updateMutation.mutate(
            { restrictedEditors, pinnedEditorVersions },
            {
                onSuccess: () => {
                    toast({ message: "Editor options updated" });
                    onClose();
                },
            },
        );
    };

    const computedError = useMemo(() => {
        if (!ideOptionsArr) {
            return;
        }
        const leftOptions = ideOptionsArr.filter((i) => !restrictedEditors.has(i.id));
        if (leftOptions.length === 0) {
            return "At least one Editor has to be selected.";
        }
    }, [restrictedEditors, ideOptionsArr]);

    const errMessage = useMemo(() => {
        if (computedError) {
            return computedError;
        }
        if (updateMutation.isError) {
            return String(updateMutation.error);
        }
        if (editorVersionsQuery.isError) {
            return String(editorVersionsQuery.error);
        }
        return undefined;
    }, [
        computedError,
        updateMutation.isError,
        updateMutation.error,
        editorVersionsQuery.isError,
        editorVersionsQuery.error,
    ]);

    const isLoading = props.isLoading || isLoadingEditorVersions;

    return (
        <Modal visible onClose={onClose} onSubmit={handleUpdate}>
            <ModalHeader>Available Editors</ModalHeader>
            <ModalBody>
                {isLoading ? (
                    <LoadingState />
                ) : (
                    ideOptionsArr!.map((ide) => (
                        <IdeOptionSwitch
                            key={ide.id}
                            ideOption={ide}
                            ideVersions={editorVersions?.[ide.id]}
                            pinnedIdeVersion={pinnedEditorVersions.get(ide.id)}
                            checked={!restrictedEditors.has(ide.id)}
                            onPinnedIdeVersionChange={(version) => {
                                const updatedVal = new Map(pinnedEditorVersions);
                                version ? updatedVal.set(ide.id, version) : updatedVal.delete(ide.id);
                                setPinnedEditorVersions(updatedVal);
                            }}
                            onCheckedChange={(checked) => {
                                const updatedVal = new Set(restrictedEditors);
                                checked ? updatedVal.delete(ide.id) : updatedVal.add(ide.id);
                                setEditors(updatedVal);
                            }}
                        />
                    ))
                )}
            </ModalBody>
            <ModalBaseFooter className="justify-between">
                <div className="text-red-500">{errMessage}</div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <LoadingButton
                        disabled={!!computedError || props.isLoading}
                        type="submit"
                        loading={updateMutation.isLoading}
                    >
                        Save
                    </LoadingButton>
                </div>
            </ModalBaseFooter>
        </Modal>
    );
};

interface IdeOptionSwitchProps {
    ideOption: IDEOption & { id: string };
    ideVersions: string[] | undefined;
    pinnedIdeVersion: string | undefined;
    checked: boolean;
    onPinnedIdeVersionChange: (version: string | undefined) => void;
    onCheckedChange: (checked: boolean) => void;
}
const IdeOptionSwitch = ({
    ideOption,
    ideVersions,
    pinnedIdeVersion,
    checked,
    onCheckedChange,
    onPinnedIdeVersionChange,
}: IdeOptionSwitchProps) => {
    const label = (
        <>
            <img className="w-8 h-8 self-center mr-2" src={ideOption.logo} alt="" />
            <span className="font-medium text-pk-content-primary">{ideOption.title}</span>
        </>
    );

    const versionSelector = !!pinnedIdeVersion && !!ideVersions && (
        <select
            className="py-0 pl-2 pr-7 w-auto"
            name="Editor version"
            value={pinnedIdeVersion}
            onChange={(e) => onPinnedIdeVersionChange(e.target.value)}
        >
            {ideVersions.map((v) => (
                <option key={v} value={v}>
                    {v}
                </option>
            ))}
        </select>
    );
    const description = (
        <div className="inline-flex items-center text-pk-content-primary">
            {versionSelector ? (
                <>
                    <MiddleDot />
                    <PinIcon size={16} />
                    {versionSelector}
                </>
            ) : (
                ideOption.imageVersion && (
                    <>
                        <MiddleDot />
                        <span className="text-pk-content-primary">{ideOption.imageVersion}</span>
                    </>
                )
            )}
            <MiddleDot />
            <span className="text-pk-content-primary capitalize">{ideOption.type}</span>
        </div>
    );
    return (
        <div className="flex w-full justify-between items-center mt-2">
            <SwitchInputField
                key={ideOption.id}
                id={ideOption.id}
                label={label}
                description={description}
                labelLayout="row"
                checked={checked}
                onCheckedChange={onCheckedChange}
                title={ideOption.title}
            />
            {ideOption.pinnable && !!ideVersions && (
                <Button
                    type="button"
                    onClick={() => onPinnedIdeVersionChange(pinnedIdeVersion ? undefined : ideVersions[0])}
                    variant="ghost"
                    className={cn("text-sm select-none font-normal p-0", "text-blue-500")}
                >
                    {`${pinnedIdeVersion ? "Unpin" : "Pin a"} version`}
                </Button>
            )}
        </div>
    );
};

function filteredIdeOptions(ideOptions: IDEOptions) {
    return IDEOptions.asArray(ideOptions).filter((x) => !x.hidden);
}

function sortedIdeOptions(ideOptions: IDEOptions) {
    return filteredIdeOptions(ideOptions).sort((a, b) => {
        // Prefer experimental options
        if (a.experimental && !b.experimental) {
            return -1;
        }
        if (!a.experimental && b.experimental) {
            return 1;
        }

        if (!a.orderKey || !b.orderKey) {
            return 0;
        }

        return parseInt(a.orderKey, 10) - parseInt(b.orderKey, 10);
    });
}
