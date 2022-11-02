/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Arrow from "../components/Arrow";

interface PaginationNavigationButtonProps {
    isDisabled: boolean;
    label: string;
    arrowDirection: string;
    onClick: () => void;
}

function PaginationNavigationButton(props: PaginationNavigationButtonProps) {
    const activeArrowClass = props.isDisabled
        ? "border-gray-300 dark:border-gray-500"
        : "border-gray-500 dark:border-gray-400 group-hover:border-gray-600 dark:group-hover:border-gray-400";

    return (
        <li
            className={`font-semibold text-gray-300 ${
                props.isDisabled ? "disabled dark:text-gray-500" : "cursor-pointer dark:text-gray-400 text-gray-500"
            }`}
        >
            <span onClick={props.onClick}>
                {props.arrowDirection === "right" && props.label}
                <Arrow direction={props.arrowDirection} customBorderClasses={activeArrowClass} />
                {props.arrowDirection === "left" && props.label}
            </span>
        </li>
    );
}

export default PaginationNavigationButton;
