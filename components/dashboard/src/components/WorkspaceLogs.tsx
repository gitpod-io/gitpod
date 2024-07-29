/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import { useContext, useEffect, useMemo, useRef } from "react";
import { Terminal, ITerminalOptions, ITheme } from "@xterm/xterm";
import debounce from "lodash/debounce";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
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

export interface Props {
    taskId: string;
    logsEmitter: EventEmitter;
    errorMessage?: string;
    classes?: string;
    xtermClasses?: string;
}

const MAX_CHUNK_SIZE = 1024 * 4; // 4KB

export default function WorkspaceLogs({ logsEmitter, errorMessage, classes, xtermClasses }: Props) {
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

        let logBuffer = new Uint8Array();
        let isWriting = false;

        const processNextLog = () => {
            if (isWriting || logBuffer.length === 0) return;

            const logs = logBuffer.subarray(0, MAX_CHUNK_SIZE);
            logBuffer = logBuffer.subarray(logs.length);
            if (logs) {
                isWriting = true;
                terminal.write(logs, () => {
                    isWriting = false;
                    processNextLog();
                });
            }
        };

        const logListener = (logs: Uint8Array) => {
            if (!logs) return;

            const newBuffer = new Uint8Array(logBuffer.length + logs.length);
            newBuffer.set(logBuffer);
            newBuffer.set(logs, logBuffer.length);
            logBuffer = newBuffer;

            processNextLog();
        };

        const resetListener = () => {
            terminal.clear();
            logBuffer = new Uint8Array();
            isWriting = false;
        };

        const emitter = logsEmitter.on("logs", logListener);
        emitter.on("reset", resetListener);
        fitAddon.fit();

        return () => {
            terminal.dispose();
            emitter.removeListener("logs", logListener);
            emitter.removeListener("reset", resetListener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logsEmitter]);

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
        if (terminalRef.current && errorMessage) {
            terminalRef.current.write(`\r\n\u001b[38;5;196m${errorMessage}\u001b[0m\r\n`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [terminalRef.current, errorMessage]);

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
                classes || "mt-6 h-72 w-11/12 lg:w-3/5 rounded-xl overflow-hidden",
                "bg-pk-surface-secondary relative text-left",
            )}
        >
            <div
                className={cn(xtermClasses || "absolute top-0 left-0 bottom-0 right-0 m-6")}
                ref={xTermParentRef}
            ></div>
        </div>
    );
}
