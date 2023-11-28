/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, forwardRef, useCallback, useMemo } from "react";
import ReactDatePicker from "react-datepicker";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { Subheading } from "../components/typography/headings";
import dayjs, { Dayjs } from "dayjs";
import { useToast } from "../components/toasts/Toasts";
import { Button } from "@podkit/buttons/Button";

const MAX_HOURS = 300 * 24; // 300 days

type Props = {
    startDate: Dayjs;
    endDate: Dayjs;
    onDateRangeChange: (params: { start?: Dayjs; end?: Dayjs }) => void;
};
export const UsageDateFilters: FC<Props> = ({ startDate, endDate, onDateRangeChange }) => {
    const { toast } = useToast();

    const handleStartDateChange = useCallback(
        (date: Date | null) => {
            if (!date) {
                return;
            }

            const start = dayjs(date).startOf("day");

            let end;

            // Automatically adjust end date if > 300 days
            if (endDate.endOf("day").diff(start.startOf("day"), "hours") >= MAX_HOURS) {
                end = start.add(MAX_HOURS, "hours").subtract(1, "day").endOf("day");
                toast("Usage date range is limited to 300 days. Your end date was adjusted for you automatically.");
            }

            onDateRangeChange({ start, end });
        },
        [endDate, onDateRangeChange, toast],
    );

    const handleEndDateChange = useCallback(
        (date: Date | null) => {
            if (!date) {
                return;
            }
            const end = dayjs(date).endOf("day");

            let start;

            // Automatically adjust start date if > 300 days
            if (end.diff(startDate, "hours") >= MAX_HOURS) {
                start = end.subtract(MAX_HOURS, "hours").add(1, "day").startOf("day");
                toast("Usage date range is limited to 300 days. Your start date was adjusted for you automatically.");
            }

            onDateRangeChange({ start, end });
        },
        [onDateRangeChange, startDate, toast],
    );

    return (
        <div
            className={classNames(
                "flex flex-col items-start space-y-3",
                "sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0",
            )}
        >
            <UsageDateRangePicker startDate={startDate} endDate={endDate} onChange={onDateRangeChange} />
            <div className="flex items-center space-x-1">
                <ReactDatePicker
                    selected={startDate.toDate()}
                    onChange={handleStartDateChange}
                    selectsStart
                    startDate={startDate.toDate()}
                    endDate={endDate.toDate()}
                    maxDate={endDate.toDate()}
                    customInput={<DateDisplay />}
                    dateFormat={"MMM d, yyyy"}
                    // tab loop enabled causes a bug w/ layout shift to the right of input when open
                    enableTabLoop={false}
                />
                <Subheading>to</Subheading>
                <ReactDatePicker
                    selected={endDate.toDate()}
                    onChange={handleEndDateChange}
                    selectsEnd
                    startDate={startDate.toDate()}
                    endDate={endDate.toDate()}
                    minDate={startDate.toDate()}
                    customInput={<DateDisplay />}
                    dateFormat={"MMM d, yyyy"}
                    enableTabLoop={false}
                />
            </div>
        </div>
    );
};

type UsageDateRangePickerProps = {
    startDate: Dayjs;
    endDate: Dayjs;
    onChange: (params: { start: Dayjs; end: Dayjs }) => void;
};
const UsageDateRangePicker: FC<UsageDateRangePickerProps> = ({ startDate, endDate, onChange }) => {
    const entries = useMemo<ContextMenuEntry[]>(() => {
        const now = dayjs();
        const startOfCurrentMonth = now.startOf("month");

        const entries: ContextMenuEntry[] = [
            {
                title: "Current month",
                onClick: () => onChange({ start: startOfCurrentMonth, end: now }),
                active: startDate.isSame(startOfCurrentMonth, "day") && endDate.isSame(now, "day"),
            },
        ];

        // This goes back 6 months from the current month
        for (let i = 1; i < 7; i++) {
            const entryStart = now.subtract(i, "month").startOf("month");
            const entryEnd = entryStart.endOf("month");
            entries.push({
                title: entryStart.format("MMM YYYY"),
                active: startDate.isSame(entryStart, "day") && endDate.isSame(entryEnd, "day"),
                onClick: () => onChange({ start: entryStart, end: entryEnd }),
            });
        }

        return entries;
    }, [endDate, onChange, startDate]);

    const selectedEntry = useMemo(() => entries.find((e) => e.active), [entries]);

    return (
        <ContextMenu menuEntries={entries} customClasses="left-0">
            <DateDisplay value={selectedEntry?.title ?? "Custom range"} onClick={noop} />
        </ContextMenu>
    );
};

type DateDisplayProps = {
    value?: string;
    onClick?: () => void;
};
const DateDisplay = forwardRef<any, DateDisplayProps>(({ value, onClick }, ref) => {
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            ref={ref}
            className={classNames(
                "w-40",
                "px-4 py-2 my-auto rounded-md",
                "justify-start text-left",
                "bg-white dark:bg-gray-800",
                "text-gray-600 dark:text-gray-400",
                "border border-gray-300 dark:border-gray-500",
                "focus:border-gray-400 dark:focus:border-gray-400 focus:ring-0",
                "hover:bg-gray-100 dark:hover:bg-gray-900",
            )}
        >
            <span>{value}</span>
            <svg
                className="absolute -mt-2 top-1/2 right-2"
                width="20"
                height="20"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                onClick={onClick}
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
                />
                <title>Change Date</title>
            </svg>
        </Button>
    );
});

const noop = () => {};
