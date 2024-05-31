/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import { useContext, useEffect, useMemo, useRef } from "react";
import { Terminal, ITerminalOptions, ITheme } from "xterm";
import debounce from "lodash/debounce";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { ThemeContext } from "../theme-context";
import { cn } from "@podkit/lib/cn";

const darkTheme: ITheme = {
    // What written on DevTool dark:bg-gray-800 is
    background: "#23211E", // Tailwind's warmGray 50 https://tailwindcss.com/docs/customizing-colors
    selectionBackground: "#add6ff26", // https://github.com/gitpod-io/gitpod-vscode-theme/blob/6fb17ba8915fcd68fde3055b4bc60642ce5eed14/themes/gitpod-dark-color-theme.json#L15
};
const lightTheme: ITheme = {
    background: "#F9F9F9", // Tailwind's warmGray 800 https://tailwindcss.com/docs/customizing-colors
    foreground: "#78716C", // Tailwind's warmGray 500 https://tailwindcss.com/docs/customizing-colors
    cursor: "#78716C", // Tailwind's warmGray 500 https://tailwindcss.com/docs/customizing-colors
    selectionBackground: "#add6ff80", // https://github.com/gitpod-io/gitpod-vscode-theme/blob/6fb17ba8915fcd68fde3055b4bc60642ce5eed14/themes/gitpod-light-color-theme.json#L15
};

export interface WorkspaceLogsProps {
    logsEmitter: EventEmitter;
    errorMessage?: string;
    classes?: string;
    xtermClasses?: string;
}

export default function WorkspaceLogs(props: WorkspaceLogsProps) {
    const xTermParentRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal>();
    const fitAddon = useMemo(() => new FitAddon(), []);
    const { isDark } = useContext(ThemeContext);

    useEffect(() => {
        if (!xTermParentRef.current) {
            return;
        }
        const options: ITerminalOptions = {
            cursorBlink: false,
            disableStdin: true,
            fontSize: 14,
            theme: darkTheme,
            scrollback: 9999999,
        };
        const terminal = new Terminal(options);
        terminalRef.current = terminal;
        terminal.loadAddon(fitAddon);
        terminal.open(xTermParentRef.current);
        props.logsEmitter.on("logs", (logs) => {
            if (terminal && logs) {
                terminal.write(logs);
            }
        });
        fitAddon.fit();

        return () => {
            terminal.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.logsEmitter]);

    const resizeDebounced = debounce(
        () => {
            fitAddon.fit();
        },
        50,
        { leading: true, trailing: true },
    );

    useEffect(() => {
        // Fit terminal on window resize (debounced)
        window.addEventListener("resize", resizeDebounced);

        return () => {
            window.removeEventListener("resize", resizeDebounced);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (terminalRef.current && props.errorMessage) {
            terminalRef.current.write(`\r\n\u001b[38;5;196m${props.errorMessage}\u001b[0m\r\n`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [terminalRef.current, props.errorMessage]);

    useEffect(() => {
        if (!terminalRef.current) {
            return;
        }
        terminalRef.current.options.theme = isDark ? darkTheme : lightTheme;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [terminalRef.current, isDark]);

    return (
        <div
            className={cn(
                props.classes || "mt-6 h-72 w-11/12 lg:w-3/5 rounded-xl overflow-hidden",
                "bg-pk-surface-secondary relative text-left",
            )}
        >
            <div
                className={cn(props.xtermClasses || "absolute top-0 left-0 bottom-0 right-0 m-6")}
                ref={xTermParentRef}
            ></div>
        </div>
    );
}
