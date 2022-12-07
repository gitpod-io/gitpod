/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

interface DateSelectorProps {
    title: string;
    description: string;
    options: { value: string; label: string }[];
    value?: string;
    onChange: (value: string) => void;
}

function DateSelector(props: DateSelectorProps) {
    return (
        <div>
            <label htmlFor={props.title} className="font-semibold">
                {props.title}
            </label>
            <select name={props.title} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
                {props.options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{props.description}</p>
        </div>
    );
}

export default DateSelector;
