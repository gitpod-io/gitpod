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
import { useIDEVersionsQuery } from "../data/ide-options/ide-options-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { AllowedWorkspaceEditor } from "../data/ide-options/ide-options-query";

interface IdeOptionsProps {
    ideOptions: AllowedWorkspaceEditor[] | undefined;
    pinnedEditorVersions: Map<string, string>;
    className?: string;
    emptyState?: React.ReactNode;
    isLoading?: boolean;
}

export const IdeOptions = (props: IdeOptionsProps) => {
    if (props.isLoading) {
        return <LoadingState />;
    }
    if ((!props.ideOptions || props.ideOptions.length === 0) && props.emptyState) {
        return <>{props.emptyState}</>;
    }
    return (
        <div className={cn("space-y-2", props.className)}>
            {props.ideOptions &&
                props.ideOptions.map((ide) => (
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
    ideOptions: AllowedWorkspaceEditor[] | undefined;
    restrictedEditors: Set<string>;
    hidePinEditorInputs?: boolean;
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
    hidePinEditorInputs,
    ...props
}: IdeOptionsModifyModalProps) => {
    const orgLevelEditorVersionPinningEnabled = useFeatureFlag("org_level_editor_version_pinning_enabled");

    const ideOptionsArr = ideOptions;
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
        const leftOptions = ideOptionsArr
            .filter((e) => !e.isDisabledInScope)
            .filter((i) => !restrictedEditors.has(i.id));
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
                            ideVersions={hidePinEditorInputs ? undefined : editorVersions?.[ide.id]}
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
    ideOption: AllowedWorkspaceEditor;
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
    const contentColor = ideOption.isDisabledInScope ? "text-pk-content-disabled" : "text-pk-content-primary";
    const label = (
        <>
            <img className="w-8 h-8 self-center mr-2" src={ideOption.logo} alt="" />
            <span className={cn("font-medium", contentColor)}>{ideOption.title}</span>
        </>
    );

    const versionSelector = !!pinnedIdeVersion && !!ideVersions && ideVersions.length > 0 && (
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
        <div className={cn("inline-flex items-center", contentColor)}>
            {(ideOption.imageVersion || pinnedIdeVersion || versionSelector) && (
                <>
                    <MiddleDot />
                    {(pinnedIdeVersion || versionSelector) && <PinIcon size={16} />}
                    {versionSelector || <span>{pinnedIdeVersion || ideOption.imageVersion}</span>}
                </>
            )}
            <MiddleDot />
            <span className="capitalize">{ideOption.type}</span>
        </div>
    );

    const computedState = useMemo(() => {
        if (ideOption.isDisabledInScope && ideOption.disableScope === "organization") {
            return {
                title: "Your organization has disabled this editor",
                classes: "cursor-not-allowed",
            };
        }
        return {
            title: ideOption.title,
            classes: "",
        };
    }, [ideOption]);

    return (
        <div className={cn("flex w-full justify-between items-center mt-2", contentColor, computedState.classes)}>
            <SwitchInputField
                key={ideOption.id}
                id={ideOption.id}
                label={label}
                disabled={ideOption.isDisabledInScope}
                description={description}
                labelLayout="row"
                checked={!ideOption.isDisabledInScope && checked}
                onCheckedChange={onCheckedChange}
                title={computedState.title}
                className={computedState.classes}
            />
            {ideOption.pinnable && !!ideVersions && ideVersions.length > 0 && (
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
