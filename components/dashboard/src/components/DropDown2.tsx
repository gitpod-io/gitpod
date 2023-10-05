/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FC, FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Arrow from "./Arrow";
import classNames from "classnames";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { usePopper } from "react-popper";
import { Portal } from "react-portal";

export interface DropDown2Element {
    id: string;
    element: JSX.Element;
    isSelectable?: boolean;
}

export interface DropDown2Props {
    getElements: (searchString: string) => DropDown2Element[];
    disabled?: boolean;
    loading?: boolean;
    searchPlaceholder?: string;
    disableSearch?: boolean;
    expanded?: boolean;
    onSelectionChange: (id: string) => void;
    // Meant to allow consumers to react to search changes even though state is managed internally
    onSearchChange?: (searchString: string) => void;
    allOptions?: string;
}

export const DropDown2: FunctionComponent<DropDown2Props> = ({
    disabled = false,
    loading = false,
    expanded = false,
    searchPlaceholder,
    allOptions,
    getElements,
    disableSearch,
    children,
    onSelectionChange,
    onSearchChange,
}) => {
    const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
    const [dropdownEl, setDropdownEl] = useState<HTMLElement | null>(null);

    // this calculates the positioning for our tooltip
    const { styles, attributes } = usePopper(triggerEl, dropdownEl, {
        placement: "bottom",
    });

    const [showDropDown, setShowDropDown] = useState<boolean>(!disabled && !!expanded);
    // const nodeRef: RefObject<HTMLDivElement> = useRef(null);
    const onSelected = useCallback(
        (elementId: string) => {
            onSelectionChange(elementId);
            setShowDropDown(false);
        },
        [onSelectionChange],
    );
    const [search, setSearch] = useState<string>("");
    const filteredOptions = useMemo(() => getElements(search), [getElements, search]);
    const [selectedElementTemp, setSelectedElementTemp] = useState<string | undefined>(filteredOptions[0]?.id);

    // reset search when the drop down is expanded or closed
    useEffect(() => {
        updateSearch("");
        if (allOptions) {
            setSelectedElementTemp(allOptions);
        }
        if (showDropDown && selectedElementTemp) {
            document.getElementById(selectedElementTemp)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        // we only want this behavior when showDropDown changes to true.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDropDown]);

    const updateSearch = useCallback(
        (value: string) => {
            setSearch(value);
            if (onSearchChange) {
                onSearchChange(value);
            }
        },
        [onSearchChange],
    );

    const toggleDropDown = useCallback(() => {
        if (disabled) {
            return;
        }
        setShowDropDown(!showDropDown);
    }, [disabled, showDropDown]);

    const setFocussedElement = useCallback(
        (element: string) => {
            setSelectedElementTemp(element);
            document.getElementById(element)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            document.getElementById(element)?.focus();
        },
        [setSelectedElementTemp],
    );

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (showDropDown && e.key === "ArrowDown") {
                e.preventDefault();
                let idx = filteredOptions.findIndex((e) => e.id === selectedElementTemp);
                while (idx++ < filteredOptions.length - 1) {
                    const candidate = filteredOptions[idx];
                    if (candidate.isSelectable) {
                        setFocussedElement(candidate.id);
                        return;
                    }
                }
                return;
            }
            if (showDropDown && e.key === "ArrowUp") {
                e.preventDefault();
                let idx = filteredOptions.findIndex((e) => e.id === selectedElementTemp);
                while (idx-- > 0) {
                    const candidate = filteredOptions[idx];
                    if (candidate.isSelectable) {
                        setFocussedElement(candidate.id);
                        return;
                    }
                }
                return;
            }
            if (showDropDown && e.key === "Escape") {
                setShowDropDown(false);
                e.preventDefault();
            }
            if (e.key === "Enter") {
                if (showDropDown && selectedElementTemp && filteredOptions.some((e) => e.id === selectedElementTemp)) {
                    e.preventDefault();
                    onSelectionChange(selectedElementTemp);
                    setShowDropDown(false);
                }
                if (!showDropDown) {
                    toggleDropDown();
                    e.preventDefault();
                }
            }
            if (e.key === " " && search === "") {
                toggleDropDown();
                e.preventDefault();
            }
        },
        [
            filteredOptions,
            onSelectionChange,
            search,
            selectedElementTemp,
            setFocussedElement,
            showDropDown,
            toggleDropDown,
        ],
    );

    const handleBlur = useCallback(
        (e: React.FocusEvent) => {
            setShowDropDown(false);
            // postpone a little, so it doesn't fire before a click event for the main element.
            // setTimeout(() => {
            //     // only close if the focussed element is not child
            //     if (!triggerEl?.current?.contains(window.document.activeElement)) {
            //         setShowDropDown(false);
            //     }
            // }, 100);
        },
        [setShowDropDown],
    );

    const showInputLoadingIndicator = filteredOptions.length > 0 && loading;
    const showResultsLoadingIndicator = filteredOptions.length === 0 && loading;

    return (
        <div
            onKeyDown={onKeyDown}
            onBlur={handleBlur}
            ref={setTriggerEl}
            tabIndex={0}
            className={classNames(
                "relative flex flex-col rounded-lg  focus:outline-none focus:ring-2 focus:ring-blue-300",
            )}
        >
            <div
                className={classNames(
                    "h-16 bg-gray-100 dark:bg-gray-800 flex items-center px-2",
                    // when open, just have border radius on top
                    showDropDown ? "rounded-t-lg" : "rounded-lg",
                    // Dropshadow when expanded
                    showDropDown && "filter drop-shadow-xl",
                    // hover when not disabled or expanded
                    !showDropDown && !disabled && "hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer",
                    // opacity when disabled
                    disabled && "opacity-70",
                )}
                onClick={toggleDropDown}
            >
                {children}
                <div className="flex-grow" />
                <div className="mr-2">
                    <Arrow direction={showDropDown ? "up" : "down"} />
                </div>
            </div>
            {showDropDown && (
                <Portal>
                    <div
                        ref={setDropdownEl}
                        className="absolute w-full top-12 bg-gray-100 dark:bg-gray-800 rounded-b-lg mt-3 z-50 p-2 filter drop-shadow-xl"
                        style={styles.popper}
                        {...attributes.popper}
                    >
                        {!disableSearch && (
                            <div className="relative mb-2">
                                <input
                                    type="text"
                                    autoFocus
                                    className={"w-full focus rounded-lg"}
                                    placeholder={searchPlaceholder}
                                    value={search}
                                    onChange={(e) => updateSearch(e.target.value)}
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
                                    let selectionClasses = `dark:bg-gray-800 cursor-pointer`;
                                    if (element.id === selectedElementTemp) {
                                        selectionClasses = `bg-gray-200 dark:bg-gray-700 cursor-pointer  focus:outline-none focus:ring-0`;
                                    }
                                    if (!element.isSelectable) {
                                        selectionClasses = ``;
                                    }
                                    return (
                                        <li
                                            key={element.id}
                                            id={element.id}
                                            tabIndex={0}
                                            className={
                                                "h-min rounded-lg flex items-center px-2 py-1.5 " + selectionClasses
                                            }
                                            onMouseDown={() => {
                                                if (element.isSelectable) {
                                                    setFocussedElement(element.id);
                                                    onSelected(element.id);
                                                }
                                            }}
                                            onMouseOver={() => setFocussedElement(element.id)}
                                            onFocus={() => setFocussedElement(element.id)}
                                        >
                                            {element.element}
                                        </li>
                                    );
                                })
                            ) : !showResultsLoadingIndicator ? (
                                <li key="no-elements" className={"rounded-md "}>
                                    <div className="h-12 pl-8 py-3 text-gray-800 dark:text-gray-200">No results</div>
                                </li>
                            ) : null}
                        </ul>
                    </div>
                </Portal>
            )}
        </div>
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
