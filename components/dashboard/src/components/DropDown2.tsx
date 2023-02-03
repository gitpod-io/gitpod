/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FunctionComponent, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Arrow from "./Arrow";

export interface DropDown2Element {
    id: string;
    element: JSX.Element;
    isSelectable?: boolean;
}

export interface DropDown2Props {
    getElements: (searchString: string) => DropDown2Element[];
    searchPlaceholder?: string;
    disableSearch?: boolean;
    expanded?: boolean;
    onSelectionChange: (id: string) => void;
}

export const DropDown2: FunctionComponent<DropDown2Props> = (props) => {
    const [showDropDown, setShowDropDown] = useState<boolean>(!!props.expanded);
    const nodeRef: RefObject<HTMLDivElement> = useRef(null);
    const onSelected = useCallback(
        (elementId: string) => {
            props.onSelectionChange(elementId);
            setShowDropDown(false);
        },
        [props],
    );
    const [search, setSearch] = useState<string>("");
    const filteredOptions = useMemo(() => props.getElements(search), [props, search]);
    const [selectedElementTemp, setSelectedElementTemp] = useState<string | undefined>(filteredOptions[0]?.id);

    // reset search when the drop down is expanded or closed
    useEffect(() => {
        setSearch("");
        if (showDropDown && selectedElementTemp) {
            document.getElementById(selectedElementTemp)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        // we only want this behavior when showDropDown changes to true.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDropDown]);

    const toggleDropDown = useCallback(() => {
        setShowDropDown(!showDropDown);
    }, [setShowDropDown, showDropDown]);

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
                    props.onSelectionChange(selectedElementTemp);
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
        [filteredOptions, props, selectedElementTemp, setFocussedElement, showDropDown, toggleDropDown],
    );

    const handleBlur = useCallback(
        (e: React.FocusEvent) => {
            // postpone a little, so it doesn't fire before a click event for the main element.
            setTimeout(() => {
                // only close if the focussed element is not child
                if (!nodeRef?.current?.contains(window.document.activeElement)) {
                    setShowDropDown(false);
                }
            }, 100);
        },
        [setShowDropDown],
    );

    return (
        <div
            onKeyDown={onKeyDown}
            onBlur={handleBlur}
            ref={nodeRef}
            tabIndex={0}
            className={"relative flex flex-col rounded-lg  focus:outline-none focus:ring-2 focus:ring-blue-300"}
        >
            <div
                className={
                    "h-16 bg-gray-100 dark:bg-gray-800 flex items-center px-2 " +
                    (showDropDown
                        ? "rounded-t-lg"
                        : "rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer")
                }
                onClick={toggleDropDown}
            >
                {props.children}
                <div className="flex-grow" />
                <div className="mr-2">
                    <Arrow direction={showDropDown ? "up" : "down"} />
                </div>
            </div>
            {showDropDown && (
                <>
                    <div className="absolute w-full top-12 bg-gray-100 dark:bg-gray-800 max-h-72 overflow-auto rounded-b-lg mt-3 z-50 p-2">
                        {!props.disableSearch && (
                            <div className="h-12">
                                <input
                                    type="text"
                                    autoFocus
                                    className={"w-full focus rounded-lg"}
                                    placeholder={props.searchPlaceholder}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        )}
                        <ul>
                            {filteredOptions.length > 0 ? (
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
                                            className={"h-16 rounded-lg flex items-center px-2 " + selectionClasses}
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
                            ) : (
                                <li key="no-elements" className={"rounded-md "}>
                                    <div className="h-12 pl-8 py-3 text-gray-800 dark:text-gray-200">No results</div>
                                </li>
                            )}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};
