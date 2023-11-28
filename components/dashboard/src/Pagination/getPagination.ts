/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export function getPaginationNumbers(totalNumberOfPages: number, currentPage: number) {
    const adjacentToCurrentPage = 1; // This is the number(s) we see next to the currentPage
    const numberOfPagesToShowOnTheSide = 3;
    const totalNumbersShownInPagination = 6;
    let calculatedPagination: number[] = [];

    const pageNumbersAsArray = (startRange: number, endRange: number) => {
        return [...Array(endRange + 1).keys()].slice(startRange);
    };

    const minimumAmountInBetweenToShowEllipsis = 2;
    // Without ellipsis aka normal case
    if (totalNumberOfPages <= totalNumbersShownInPagination) {
        return (calculatedPagination = pageNumbersAsArray(1, totalNumberOfPages));
    }

    // Otherwise, we show the ellipses
    const toTheRightOfCurrent = Math.min(currentPage + adjacentToCurrentPage, totalNumberOfPages);
    const toTheLeftOfCurrent = Math.max(currentPage - adjacentToCurrentPage, 1);

    const showRightEllipsis = toTheRightOfCurrent < totalNumberOfPages - minimumAmountInBetweenToShowEllipsis; // e.g. "1 2 3 ... 7"
    const showLeftEllipsis =
        currentPage > numberOfPagesToShowOnTheSide + adjacentToCurrentPage &&
        toTheLeftOfCurrent > minimumAmountInBetweenToShowEllipsis; // e.g. 1 ... 5 6 7"

    if (showRightEllipsis && !showLeftEllipsis) {
        const leftSideNumbers = Math.max(numberOfPagesToShowOnTheSide, currentPage + adjacentToCurrentPage);
        const leftPageNumbersAsArray = pageNumbersAsArray(1, leftSideNumbers);
        return [...leftPageNumbersAsArray, "...", totalNumberOfPages];
    }

    if (showLeftEllipsis && !showRightEllipsis) {
        const rightSideNumbers = Math.max(
            numberOfPagesToShowOnTheSide,
            totalNumberOfPages - currentPage + adjacentToCurrentPage,
        );
        const rightPageNumbersAsArray = pageNumbersAsArray(totalNumberOfPages - rightSideNumbers, totalNumberOfPages);
        return [1, "...", ...rightPageNumbersAsArray];
    }

    if (showRightEllipsis && showLeftEllipsis) {
        const middleNumbers = pageNumbersAsArray(toTheLeftOfCurrent, toTheRightOfCurrent);
        return [1, "...", ...middleNumbers, "...", totalNumberOfPages];
    }

    return calculatedPagination;
}
