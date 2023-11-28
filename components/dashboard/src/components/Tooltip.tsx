/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ReactNode, useCallback, useEffect, useState } from "react";
import { Portal } from "react-portal";
import { usePopper } from "react-popper";

export interface TooltipProps {
    className?: string;
    children: ReactNode;
    content: string;
    allowWrap?: boolean;
}

function Tooltip(props: TooltipProps) {
    const [expanded, setExpanded] = useState(false);
    const [showTooltipTimeout, setShowTooltipTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
    const [tooltipEl, setTooltipEl] = useState<HTMLElement | null>(null);

    // this calculates the positioning for our tooltip
    const { styles, attributes, update } = usePopper(triggerEl, tooltipEl, {
        placement: "top",
    });

    // If the tooltip contents change, force a recalc on positioning
    useEffect(() => {
        update?.();
    }, [update, props.content]);

    // Adds a 500ms delay to showing tooltip so we don't show them until user pauses a bit like native browser tooltips
    const handleShow = useCallback(() => {
        const timeout = setTimeout(() => {
            setExpanded(true);
        }, 500);
        setShowTooltipTimeout(timeout);
    }, []);

    const handleHide = useCallback(() => {
        if (showTooltipTimeout) {
            clearTimeout(showTooltipTimeout);
        }
        setShowTooltipTimeout(null);
        setExpanded(false);
    }, [showTooltipTimeout]);

    return (
        <span
            onMouseEnter={handleShow}
            onFocus={handleShow}
            onMouseLeave={handleHide}
            onBlur={handleHide}
            ref={setTriggerEl}
            className={props.className}
        >
            {props.children}
            {expanded ? (
                <Portal>
                    <div
                        ref={setTooltipEl}
                        style={styles.popper}
                        className={`max-w-md z-50 py-1 px-2 bg-gray-900 text-gray-100 text-sm absolute flex flex-col border border-gray-200 dark:border-gray-800 rounded-md truncated ${
                            props.allowWrap ? "whitespace-normal" : "whitespace-nowrap"
                        }`}
                        {...attributes.popper}
                    >
                        {props.content}
                    </div>
                </Portal>
            ) : null}
        </span>
    );
}

export default Tooltip;
