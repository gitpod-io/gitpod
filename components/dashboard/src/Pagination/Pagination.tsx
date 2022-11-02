/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { getPaginationNumbers } from "./getPagination";
import PaginationNavigationButton from "./PaginationNavigationButton";

interface PaginationProps {
    totalNumberOfPages: number;
    currentPage: number;
    setPage: (page: number) => void;
}

function Pagination(props: PaginationProps) {
    const { totalNumberOfPages, setPage } = props;
    if (totalNumberOfPages <= 1 || props.currentPage < 1) {
        return <></>;
    }
    const currentPage = Math.min(totalNumberOfPages, props.currentPage);
    const calculatedPagination = getPaginationNumbers(totalNumberOfPages, currentPage);

    const nextPage = () => {
        if (currentPage !== totalNumberOfPages) setPage(currentPage + 1);
    };
    const prevPage = () => {
        if (currentPage !== 1) setPage(currentPage - 1);
    };
    const getClassnames = (pageNumber: string | number) => {
        if (pageNumber === currentPage) {
            return "font-semibold text-gray-500 dark:text-gray-400 max-h-9 max-w-8 flex items-center justify-center rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 bg-gray-100 disabled pointer-events-none px-3 py-2";
        }
        if (pageNumber === "...") {
            return "font-semibold text-gray-500 dark:text-gray-400 max-h-9 max-w-8 flex items-center justify-center rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled pointer-events-none px-3 py-2";
        }
        return "font-semibold text-gray-500 dark:text-gray-400 max-h-9 max-w-8 flex items-center justify-center rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer px-3 py-2";
    };

    return (
        <nav className="mt-16 mb-16">
            <ul className="flex justify-center items-center space-x-4">
                <PaginationNavigationButton
                    isDisabled={currentPage === 1}
                    onClick={prevPage}
                    label={"Previous"}
                    arrowDirection={"left"}
                />
                {calculatedPagination.map((pn, i) => {
                    if (pn === "...") {
                        return <li className={getClassnames(pn)}>&#8230;</li>;
                    }
                    return (
                        <li key={i} className={getClassnames(pn)} onClick={() => typeof pn === "number" && setPage(pn)}>
                            <span>{pn}</span>
                        </li>
                    );
                })}
                <PaginationNavigationButton
                    isDisabled={currentPage === totalNumberOfPages}
                    onClick={nextPage}
                    label={"Next"}
                    arrowDirection={"right"}
                />
            </ul>
        </nav>
    );
}

export default Pagination;
