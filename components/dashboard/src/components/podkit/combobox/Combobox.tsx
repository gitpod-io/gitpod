/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FC, FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { ChevronDown, CircleDashed } from "lucide-react";
import { cn } from "@podkit/lib/cn";

export interface ComboboxElement {
    id: string;
    element: JSX.Element;
    isSelectable?: boolean;
}

export interface ComboboxProps {
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

export const Combobox: FunctionComponent<ComboboxProps> = ({
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
        initialValue || (filteredOptions[0] && filteredOptions[0].isSelectable ? filteredOptions[0].id : undefined),
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
            if (!filteredOptions.find((el) => element === el.id)?.isSelectable) {
                return;
            }
            setSelectedElementTemp(element);
            const el = document.getElementById(element);
            el?.scrollIntoView({ block: "nearest" });
        },
        [filteredOptions],
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
                    "w-full h-16 bg-pk-surface-secondary flex flex-row items-center justify-start px-2 text-left",
                    // when open, just have border radius on top
                    showDropDown ? "rounded-none rounded-t-lg" : "rounded-lg",
                    // Dropshadow when expanded
                    showDropDown && "filter drop-shadow-xl",
                    // hover when not disabled or expanded
                    !showDropDown && !disabled && "hover:bg-pk-surface-tertiary cursor-pointer",
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
                    <ChevronDown />
                </div>
            </RadixPopover.Trigger>
            <RadixPopover.Portal>
                <RadixPopover.Content
                    className={cn(
                        "rounded-b-lg p-2 filter drop-shadow-xl z-50 outline-none",
                        "bg-pk-surface-secondary",
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

type ComboboxSelectedItemProps = {
    // Either a string of the icon source or an element
    icon?: ReactNode;
    loading?: boolean;
    title: ReactNode;
    subtitle?: ReactNode;
    htmlTitle?: string;
    titleClassName?: string;
};

export const ComboboxSelectedItem: FC<ComboboxSelectedItemProps> = ({
    icon,
    loading = false,
    title,
    subtitle,
    htmlTitle,
    titleClassName,
}) => {
    return (
        <div
            className={cn("flex items-center truncate", loading && "animate-pulse")}
            title={htmlTitle}
            aria-live="polite"
            aria-busy={loading}
        >
            <div className="mx-2 my-3 flex-shrink-0">
                {typeof icon === "string" ? (
                    <img className={"w-8 filter-grayscale"} src={icon} alt="logo" />
                ) : (
                    <>{icon}</>
                )}
            </div>
            <div className="flex-col ml-1 flex-grow truncate">
                {loading ? (
                    <div className="flex-col space-y-2">
                        <div className="bg-pk-content-tertiary/25 h-4 w-24 rounded" />
                        <div className="bg-pk-content-tertiary/25 h-2 w-40 rounded" />
                    </div>
                ) : (
                    <>
                        <div className={cn("text-pk-content-secondary font-semibold", titleClassName)}>{title}</div>
                        <div className="text-xs text-pk-content-tertiary truncate">{subtitle}</div>
                    </>
                )}
            </div>
        </div>
    );
};

type ComboboxItemProps = {
    element: ComboboxElement;
    isActive: boolean;
    className?: string;
    onSelected: (id: string) => void;
    onFocused: (id: string) => void;
};

export const ComboboxItem: FC<ComboboxItemProps> = ({ element, isActive, className, onSelected, onFocused }) => {
    let selectionClasses = `bg-pk-surface-tertiary/25 cursor-pointer`;
    if (isActive) {
        selectionClasses = `bg-pk-content-tertiary/10 cursor-pointer focus:outline-none focus:ring-0`;
    }
    if (!element.isSelectable) {
        selectionClasses = ``;
    }

    return (
        <li
            id={element.id}
            className={cn("h-min rounded-lg flex items-center px-2 py-1.5", selectionClasses, className)}
            onMouseDown={() => {
                if (element.isSelectable) {
                    onSelected(element.id);
                }
            }}
            onMouseOver={() => onFocused(element.id)}
            onFocus={() => onFocused(element.id)}
        >
            {element.element}
        </li>
    );
};
