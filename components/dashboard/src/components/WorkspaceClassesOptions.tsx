/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo, useState } from "react";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Button } from "@podkit/buttons/Button";
import { SwitchInputField } from "@podkit/switch/Switch";
import { cn } from "@podkit/lib/cn";
import { CpuIcon } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";
import { AllowedWorkspaceClass, DEFAULT_WS_CLASS } from "../data/workspaces/workspace-classes-query";
import { MiddleDot } from "./typography/MiddleDot";
import { useToast } from "./toasts/Toasts";
import Modal, { ModalBaseFooter, ModalBody, ModalHeader } from "./Modal";
import { LoadingState } from "@podkit/loading/LoadingState";

interface WorkspaceClassesOptionsProps {
    classes: AllowedWorkspaceClass[];
    defaultClass?: string;
    className?: string;
    emptyState?: React.ReactNode;
    isLoading?: boolean;
}

export const WorkspaceClassesOptions = (props: WorkspaceClassesOptionsProps) => {
    if (props.isLoading) {
        return <LoadingState />;
    }
    if (props.classes.length === 0 && props.emptyState) {
        return <>{props.emptyState}</>;
    }
    return (
        <div className={cn("space-y-2", props.className)}>
            {props.classes.map((cls) => (
                <div className="flex gap-2 items-center" key={cls.id}>
                    <CpuIcon size={20} />
                    <div>
                        <span className="font-medium text-pk-content-primary">{cls.displayName}</span>
                        <MiddleDot />
                        <span className="text-pk-content-primary">{cls.description}</span>
                        {props.defaultClass === cls.id && (
                            <>
                                <MiddleDot className="text-pk-content-tertiary" />
                                <span className="text-pk-content-tertiary">default</span>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export interface WorkspaceClassesModifyModalProps {
    isLoading: boolean;
    defaultClass?: string;
    restrictedWorkspaceClasses: string[];
    showSetDefaultButton: boolean;
    showSwitchTitle: boolean;

    allowedClasses: AllowedWorkspaceClass[];
    updateMutation: UseMutationResult<void, Error, { restrictedWorkspaceClasses: string[]; defaultClass?: string }>;

    onClose: () => void;
}

export const WorkspaceClassesModifyModal = ({
    onClose,
    updateMutation,
    allowedClasses,
    showSetDefaultButton,
    showSwitchTitle,
    ...props
}: WorkspaceClassesModifyModalProps) => {
    const [defaultClass, setDefaultClass] = useState(props.defaultClass || DEFAULT_WS_CLASS);
    const [restrictedClasses, setRestrictedClasses] = useState(props.restrictedWorkspaceClasses ?? []);
    const { toast } = useToast();

    const handleUpdate = async () => {
        if (computedError) {
            return;
        }
        updateMutation.mutate(
            { restrictedWorkspaceClasses: restrictedClasses, defaultClass },
            {
                onSuccess: () => {
                    toast({ message: "Workspace class updated" });
                    onClose();
                },
            },
        );
    };

    const computedError = useMemo(() => {
        const leftOptions =
            allowedClasses.filter((c) => !c.isDisabledInScope && !restrictedClasses.includes(c.id)) ?? [];
        if (leftOptions.length === 0) {
            return "At least one workspace class has to be selected.";
        }
        if (showSetDefaultButton) {
            if (!defaultClass || !leftOptions.find((cls) => cls.id === defaultClass)) {
                return "A default workspace class is required.";
            }
        }
        return;
    }, [restrictedClasses, allowedClasses, defaultClass, showSetDefaultButton]);

    return (
        <Modal visible onClose={onClose} onSubmit={handleUpdate}>
            <ModalHeader>Available workspace classes</ModalHeader>
            <ModalBody>
                {props.isLoading ? (
                    <LoadingState />
                ) : (
                    allowedClasses.map((wsClass) => (
                        <WorkspaceClassSwitch
                            showSwitchTitle={showSwitchTitle}
                            showSetDefaultButton={showSetDefaultButton}
                            restrictedClasses={restrictedClasses}
                            wsClass={wsClass}
                            isDefault={defaultClass === wsClass.id}
                            checked={!restrictedClasses.includes(wsClass.id)}
                            onSetDefault={() => {
                                setDefaultClass(wsClass.id);
                            }}
                            onCheckedChange={(checked) => {
                                const newVal = !checked
                                    ? restrictedClasses.includes(wsClass.id)
                                        ? [...restrictedClasses]
                                        : [...restrictedClasses, wsClass.id]
                                    : restrictedClasses.filter((id) => id !== wsClass.id);
                                setRestrictedClasses(newVal);
                            }}
                        />
                    ))
                )}
            </ModalBody>
            <ModalBaseFooter className="justify-between">
                <div className="text-red-500">
                    {(computedError || updateMutation.isError) && (computedError || String(updateMutation.error))}
                </div>
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

interface WorkspaceClassSwitchProps {
    wsClass: AllowedWorkspaceClass;
    restrictedClasses: string[];
    checked: boolean;
    isDefault: boolean;
    showSetDefaultButton?: boolean;
    showSwitchTitle?: boolean;
    onSetDefault: () => void;
    onCheckedChange: (checked: boolean) => void;
}
const WorkspaceClassSwitch = ({
    wsClass,
    checked,
    isDefault,
    onCheckedChange,
    ...props
}: WorkspaceClassSwitchProps) => {
    const computedState = useMemo(() => {
        if (wsClass.isDisabledInScope) {
            let descriptionScope = "";
            switch (wsClass.disableScope!) {
                case "organization":
                    descriptionScope = "Your organization";
                    break;
                case "configuration":
                    descriptionScope = "Current configuration";
                    break;
            }
            return {
                title: "Unavailable",
                classes: "cursor-not-allowed",
                disabled: true,
                switchDescription: `${descriptionScope} has disabled this class`,
            };
        }
        if (props.restrictedClasses.includes(wsClass.id)) {
            return {
                title: "Unavailable",
                classes: "cursor-not-allowed",
                disabled: true,
                switchDescription: "Current configuration has disabled this class",
            };
        }
        if (isDefault) {
            return {
                title: "Default",
                classes: "text-pk-surface",
                disabled: true,
            };
        }
        return {
            title: "Set default",
            classes: "cursor-pointer text-blue-500",
            disabled: false,
        };
    }, [props.restrictedClasses, isDefault, wsClass]);

    return (
        <div
            className={cn(
                "flex w-full justify-between items-center mt-2",
                wsClass.isDisabledInScope ? "text-pk-content-disabled" : "",
            )}
        >
            <SwitchInputField
                key={wsClass.id}
                id={wsClass.id}
                label={wsClass.displayName}
                description={wsClass.description}
                checked={checked}
                disabled={wsClass.isDisabledInScope}
                onCheckedChange={onCheckedChange}
                title={props.showSwitchTitle ? computedState.switchDescription : ""}
            />
            {!props.showSetDefaultButton ? undefined : (
                <Button
                    title={computedState.switchDescription}
                    onClick={() => {
                        props.onSetDefault();
                    }}
                    variant="ghost"
                    disabled={wsClass.isDisabledInScope || computedState.disabled}
                    className={cn("text-sm select-none font-normal", computedState.classes)}
                >
                    {computedState.title}
                </Button>
            )}
        </div>
    );
};
