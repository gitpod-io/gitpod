/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Arrow from "./Arrow";

function Pagination(props: { numberOfPages: number; currentPage: number; setCurrentPage: any }) {
    const { numberOfPages, currentPage, setCurrentPage } = props;
    const availablePageNumbers = [...Array(numberOfPages + 1).keys()].slice(1);
    const needsTruncation = availablePageNumbers.length > 5;
    let truncatedFirstHalf: number[] = [];
    let truncatedSecondHalf: number[] = [];

    if (needsTruncation) {
        truncatedFirstHalf = availablePageNumbers.slice(0, 3);
        truncatedSecondHalf = availablePageNumbers.slice(-1);
    }
    const nextPage = () => {
        if (currentPage !== numberOfPages) setCurrentPage(currentPage + 1);
    };
    const prevPage = () => {
        if (currentPage !== 1) setCurrentPage(currentPage - 1);
    };

    return (
        <nav className="mt-16">
            <ul className="flex justify-center space-x-4">
                <li className="text-gray-400 cursor-pointer">
                    <span onClick={prevPage}>
                        <Arrow direction={"left"} />
                        Previous
                    </span>
                </li>
                {!needsTruncation &&
                    availablePageNumbers.map((pn) => (
                        <li
                            key={pn}
                            className={`text-gray-500 cursor-pointer w-8 text-center rounded-md ${
                                currentPage === pn ? "bg-gray-200" : ""
                            } `}
                        >
                            <span onClick={() => setCurrentPage(pn)}>{pn}</span>
                        </li>
                    ))}
                {needsTruncation &&
                    truncatedFirstHalf.map((pn) => (
                        <>
                            <li
                                key={pn}
                                className={`text-gray-500 cursor-pointer w-8 text-center rounded-md ${
                                    currentPage === pn ? "bg-gray-200" : ""
                                } `}
                            >
                                <span onClick={() => setCurrentPage(pn)}>{pn}</span>
                            </li>
                            <span>...</span>
                            {truncatedSecondHalf.map((pn) => (
                                <li
                                    key={pn}
                                    className={`text-gray-500 cursor-pointer w-8 text-center rounded-md ${
                                        currentPage === pn ? "bg-gray-200" : ""
                                    } `}
                                >
                                    <span onClick={() => setCurrentPage(pn)}>{pn}</span>
                                </li>
                            ))}
                        </>
                    ))}
                <li className="text-gray-400 cursor-pointer">
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
