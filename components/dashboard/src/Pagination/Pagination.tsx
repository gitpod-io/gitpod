/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { getPaginationNumbers } from "./getPagination";
import Arrow from "../components/Arrow";

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
            return "text-gray-500 w-8 text-center rounded-md hover:bg-gray-50 bg-gray-100 disabled pointer-events-none";
        }
        if (pageNumber === "...") {
            return "text-gray-500 w-8 text-center rounded-md hover:bg-gray-50 disabled pointer-events-none";
        }
        return "text-gray-500 w-8 text-center rounded-md hover:bg-gray-50 cursor-pointer";
    };

    return (
        <nav className="mt-16 mb-16">
            <ul className="flex justify-center space-x-4">
                <li className={`text-gray-400 ${currentPage === 1 ? "disabled" : "cursor-pointer text-gray-500"}`}>
                    <span onClick={prevPage}>
                        <Arrow direction={"left"} />
                        Previous
                    </span>
                </li>
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
                <li
                    className={`text-gray-400 ${
                        currentPage === totalNumberOfPages ? "disabled" : "cursor-pointer text-gray-500"
                    }`}
                >
                    <span onClick={nextPage}>
                        Next
                        <Arrow direction={"right"} />
                    </span>
                </li>
            </ul>
        </nav>
    );
}

export default Pagination;
