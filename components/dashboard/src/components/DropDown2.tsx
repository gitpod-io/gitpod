/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FC, FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Arrow from "./Arrow";
import classNames from "classnames";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import * as RadixPopover from "@radix-ui/react-popover";

export interface DropDown2Element {
    id: string;
    element: JSX.Element;
    isSelectable?: boolean;
}

export interface DropDown2Props {
    initialValue?: string;
    getElements: (searchString: string) => DropDown2Element[];
    disabled?: boolean;
    loading?: boolean;
    searchPlaceholder?: string;
    disableSearch?: boolean;
    expanded?: boolean;
    onSelectionChange: (id: string) => void;
    // Meant to allow consumers to react to search changes even though state is managed internally
    onSearchChange?: (searchString: string) => void;
}

export const DropDown2: FunctionComponent<DropDown2Props> = ({
    initialValue = "",
    disabled = false,
    loading = false,
    expanded = false,
    searchPlaceholder,
    getElements,
    disableSearch,
    children,
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
                className={classNames(
                    "h-16 bg-gray-100 dark:bg-gray-800 flex flex-row items-center justify-start px-2 text-left",
                    // when open, just have border radius on top
                    showDropDown ? "rounded-none rounded-t-lg" : "rounded-lg",
                    // Dropshadow when expanded
                    showDropDown && "filter drop-shadow-xl",
                    // hover when not disabled or expanded
                    !showDropDown && !disabled && "hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer",
                    // opacity when disabled
                    disabled && "opacity-70",
                )}
            >
                {children}
                <div className="flex-grow" />
                <div className="mr-2">
                    <Arrow direction={showDropDown ? "up" : "down"} />
                </div>
            </RadixPopover.Trigger>
            <RadixPopover.Portal>
                <RadixPopover.Content
                    className={classNames(
                        "rounded-b-lg p-2 filter drop-shadow-xl z-50",
                        "bg-gray-100 dark:bg-gray-800 ",
                        "w-[--radix-popover-trigger-width]",
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
                                <div className="absolute top-0 right-0 h-full flex items-center pr-2">
                                    <Spinner className="h-4 w-4 opacity-25 animate-spin" />
                                </div>
                            )}
                        </div>
                    )}
                    <ul className="max-h-60 overflow-auto">
                        {showResultsLoadingIndicator && (
                            <div className="flex-col space-y-2 animate-pulse">
                                <div className="bg-gray-300 dark:bg-gray-500 h-4 rounded" />
                                <div className="bg-gray-300 dark:bg-gray-500 h-4 rounded" />
                            </div>
                        )}
                        {!showResultsLoadingIndicator && filteredOptions.length > 0 ? (
                            filteredOptions.map((element) => {
                                return (
                                    <Dropdown2Element
                                        key={element.id}
                                        element={element}
                                        isActive={element.id === selectedElementTemp}
                                        onSelected={onSelected}
                                        onFocused={setActiveElement}
                                    />
                                );
                            })
                        ) : !showResultsLoadingIndicator ? (
                            <li key="no-elements" className={"rounded-md "}>
                                <div className="h-12 pl-8 py-3 text-gray-800 dark:text-gray-200">No results</div>
                            </li>
                        ) : null}
                    </ul>
                </RadixPopover.Content>
            </RadixPopover.Portal>
        </RadixPopover.Root>
    );
};

type DropDown2SelectedElementProps = {
    // Either a string of the icon source or an element
    icon: ReactNode;
    loading?: boolean;
    title: ReactNode;
    subtitle: ReactNode;
    htmlTitle?: string;
};

export const DropDown2SelectedElement: FC<DropDown2SelectedElementProps> = ({
    icon,
    loading = false,
    title,
    subtitle,
    htmlTitle,
}) => {
    return (
        <div
            className={classNames("flex items-center", loading && "animate-pulse")}
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
            <div className="flex-col ml-1 flex-grow max-w-xs">
                {loading ? (
                    <div className="flex-col space-y-2">
                        <div className="bg-gray-300 dark:bg-gray-500 h-4 w-24 rounded" />
                        <div className="bg-gray-300 dark:bg-gray-500 h-2 w-40 rounded" />
                    </div>
                ) : (
                    <>
                        <div className="text-gray-700 dark:text-gray-300 font-semibold">{title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</div>
                    </>
                )}
            </div>
        </div>
    );
};

type Dropdown2ElementProps = {
    element: DropDown2Element;
    isActive: boolean;
    onSelected: (id: string) => void;
    onFocused: (id: string) => void;
};

export const Dropdown2Element: FC<Dropdown2ElementProps> = ({ element, isActive, onSelected, onFocused }) => {
    let selectionClasses = `dark:bg-gray-800 cursor-pointer`;
    if (isActive) {
        selectionClasses = `bg-gray-200 dark:bg-gray-700 cursor-pointer focus:outline-none focus:ring-0`;
    }
    if (!element.isSelectable) {
        selectionClasses = ``;
    }
    return (
        <li
            id={element.id}
            className={"h-min rounded-lg flex items-center px-2 py-1.5 " + selectionClasses}
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
