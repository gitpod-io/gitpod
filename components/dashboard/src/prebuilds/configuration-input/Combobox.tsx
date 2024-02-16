/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { ChevronDown, CircleDashed } from "lucide-react";
import { cn } from "@podkit/lib/cn";
import { ComboboxItem } from "./ComboboxItem";

export interface ComboboxElement {
    id: string;
    element: JSX.Element;
    isSelectable?: boolean;
}

export interface Props {
    initialValue?: string;
    getElements: (searchString: string) => ComboboxElement[];
    disabled?: boolean;
    loading?: boolean;
    searchPlaceholder?: string;
    disableSearch?: boolean;
    expanded?: boolean;
    className?: string;
    dropDownClassName?: string;
    itemClassName?: string;
    onSelectionChange: (id: string) => void;
    // Meant to allow consumers to react to search changes even though state is managed internally
    onSearchChange?: (searchString: string) => void;
}
export const Combobox: FunctionComponent<Props> = ({
    initialValue = "",
    disabled = false,
    loading = false,
    expanded = false,
    searchPlaceholder,
    getElements,
    disableSearch,
    children,
    className,
    dropDownClassName,
    itemClassName,
    onSelectionChange,
    onSearchChange,
}) => {
    const inputEl = useRef<HTMLInputElement>(null);
    const [showDropDown, setShowDropDown] = useState<boolean>(!disabled && !!expanded);
    const [search, setSearch] = useState<string>("");
    const filteredOptions = useMemo(() => getElements(search), [getElements, search]);
    const [selectedElementTemp, setSelectedElementTemp] = useState<string | undefined>(
        initialValue || filteredOptions[0]?.id,
    );

    const onSelected = useCallback(
        (elementId: string) => {
            onSelectionChange(elementId);
            setShowDropDown(false);
        },
        [onSelectionChange],
    );

    // scroll to selected item when opened
    useEffect(() => {
        if (showDropDown && selectedElementTemp) {
            setTimeout(() => {
                document.getElementById(selectedElementTemp)?.scrollIntoView({ block: "nearest" });
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDropDown]);

    const updateSearch = useCallback(
        (value: string) => {
            setSearch(value);
            onSearchChange?.(value);
        },
        [onSearchChange],
    );

    const handleInputChange = useCallback((e) => updateSearch(e.target.value), [updateSearch]);

    const setActiveElement = useCallback(
        (element: string) => {
            setSelectedElementTemp(element);
            const el = document.getElementById(element);
            el?.scrollIntoView({ block: "nearest" });
        },
        [setSelectedElementTemp],
    );

    const handleOpenChange = useCallback(
        (open: boolean) => {
            updateSearch("");
            setShowDropDown(open);
        },
        [updateSearch],
    );

    const focusNextElement = useCallback(() => {
        let idx = filteredOptions.findIndex((e) => e.id === selectedElementTemp);
        while (idx++ < filteredOptions.length - 1) {
            const candidate = filteredOptions[idx];
            if (candidate.isSelectable) {
                setActiveElement(candidate.id);
                return;
            }
        }
    }, [filteredOptions, selectedElementTemp, setActiveElement]);

    const focusPreviousElement = useCallback(() => {
        let idx = filteredOptions.findIndex((e) => e.id === selectedElementTemp);

        while (idx-- > 0) {
            const candidate = filteredOptions[idx];
            if (candidate.isSelectable) {
                setActiveElement(candidate.id);
                return;
            }
        }
    }, [filteredOptions, selectedElementTemp, setActiveElement]);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                focusNextElement();
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                focusPreviousElement();
                return;
            }
            if (e.key === "Tab") {
                e.preventDefault();
                if (e.shiftKey) {
                    focusPreviousElement();
                    e.stopPropagation();
                } else {
                    focusNextElement();
                }
                return;
            }
            // Capture escape ourselves instead of letting radix do it
            // allows us to close the dropdown and preventDefault on event
            if (e.key === "Escape") {
                setShowDropDown(false);
                e.preventDefault();
            }
            if (e.key === "Enter") {
                if (selectedElementTemp && filteredOptions.some((e) => e.id === selectedElementTemp)) {
                    e.preventDefault();
                    onSelected(selectedElementTemp);
                }
            }
            if (e.key === " " && search === "") {
                handleOpenChange(false);
                e.preventDefault();
            }
        },
        [
            filteredOptions,
            focusNextElement,
            focusPreviousElement,
            handleOpenChange,
            onSelected,
            search,
            selectedElementTemp,
        ],
    );

    const showInputLoadingIndicator = filteredOptions.length > 0 && loading;
    const showResultsLoadingIndicator = filteredOptions.length === 0 && loading;

    return (
        <RadixPopover.Root defaultOpen={expanded} open={showDropDown} onOpenChange={handleOpenChange}>
            <RadixPopover.Trigger
                disabled={disabled}
                className={cn(
                    "w-48 h-9 bg-pk-surface-primary hover:bg-pk-surface-primary flex flex-row items-center justify-start px-2 text-left border border-pk-border-base text-sm text-pk-content-primary",
                    // when open, just have border radius on top
                    showDropDown ? "rounded-none rounded-t-lg" : "rounded-lg",
                    // Dropshadow when expanded
                    showDropDown && "filter drop-shadow-xl",
                    // hover when not disabled or expanded
                    !showDropDown && !disabled && "cursor-pointer",
                    // opacity when disabled
                    disabled && "opacity-70",
                    className,
                )}
            >
                {children}
                <div className="flex-grow" />
                <div
                    className={cn(
                        "mr-2 text-pk-content-secondary transition-transform",
                        showDropDown && "rotate-180 transition-all",
                    )}
                >
                    <ChevronDown className="h-4 w-4 text-pk-content-disabled" />
                </div>
            </RadixPopover.Trigger>
            <RadixPopover.Portal>
                <RadixPopover.Content
                    className={cn(
                        "rounded-b-lg p-2 filter drop-shadow-xl z-50 outline-none",
                        "bg-pk-surface-primary",
                        "text-pk-content-primary",
                        "w-[--radix-popover-trigger-width]",
                        dropDownClassName,
                    )}
                    onKeyDown={onKeyDown}
                >
                    {!disableSearch && (
                        <div className="relative mb-2">
                            <input
                                ref={inputEl}
                                type="text"
                                autoFocus
                                className={"w-full focus rounded-lg"}
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={handleInputChange}
                            />
                            {showInputLoadingIndicator && (
                                <div className="absolute top-0 right-0 h-full flex items-center pr-2 animate-fade-in-fast">
                                    <CircleDashed className="opacity-10 animate-spin-slow" />
                                </div>
                            )}
                        </div>
                    )}
                    <ul className="max-h-60 overflow-auto">
                        {showResultsLoadingIndicator && (
                            <div className="flex-col space-y-2 animate-pulse">
                                <div className="bg-pk-content-tertiary/25 h-5 rounded" />
                                <div className="bg-pk-content-tertiary/25 h-5 rounded" />
                            </div>
                        )}
                        {!showResultsLoadingIndicator && filteredOptions.length > 0 ? (
                            filteredOptions.map((element) => {
                                return (
                                    <ComboboxItem
                                        key={element.id}
                                        element={element}
                                        isActive={element.id === selectedElementTemp}
                                        className={itemClassName}
                                        onSelected={onSelected}
                                        onFocused={setActiveElement}
                                    />
                                );
                            })
                        ) : !showResultsLoadingIndicator ? (
                            <li key="no-elements" className={"rounded-md "}>
                                <div className="h-12 pl-8 py-3 text-pk-content-secondary">No results</div>
                            </li>
                        ) : null}
                    </ul>
                </RadixPopover.Content>
            </RadixPopover.Portal>
        </RadixPopover.Root>
    );
};
