/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { scrubber } from "./scrubbing";

const inspect: (object: unknown) => string = require("util").inspect; // undefined in frontend

const plainLogging: boolean = false; // set to true during development to get non JSON output
let jsonLogging: boolean = false;
let component: string | undefined;
let version: string | undefined;

export interface LogContext {
    organizationId?: string;
    sessionId?: string;
    userId?: string;
    subjectId?: string;
    workspaceId?: string;
    instanceId?: string;
}

/**
 * allows to globally augment the log context, default is an identity function
 */
let logContextAugmenter: LogContext.Augmenter = (context) => context;

export namespace LogContext {
    export type Augmenter = (context: LogContext | undefined) => LogContext | undefined;
    export function setAugmenter(augmenter: Augmenter): void {
        logContextAugmenter = augmenter;
    }

    /**
     * @deprecated create LogContext directly
     */
    export function from(params: { userId?: string; user?: any; request?: any }) {
        return <LogContext>{
            sessionId: params.request?.requestID,
            userId: params.userId || params.user?.id,
        };
    }
}

let logItemHook: LogHook.Hook | undefined = undefined;
export namespace LogHook {
    export type Hook = (item: LogItem) => void;
    export function setHook(hook: Hook): void {
        logItemHook = hook;
    }
}

export interface LogPayload {
    // placeholder to indicate that only dictionary-style objects should be passed as payload
}

export namespace log {
    export function error(context: LogContext, message: string, error: unknown, payload: LogPayload): void;
    export function error(context: LogContext, message: string, error: unknown): void;
    export function error(context: LogContext, message: string, payload: LogPayload): void;
    export function error(context: LogContext, message: string): void;
    export function error(context: LogContext, error: unknown, payload: LogPayload): void;
    export function error(context: LogContext, error: unknown): void;
    export function error(message: string, error: unknown, payload: LogPayload): void;
    export function error(message: string, error: unknown): void;
    export function error(message: string, payload: LogPayload): void;
    export function error(message: string): void;
    export function error(error: unknown, payload: LogPayload): void;
    export function error(error: unknown): void;
    export function error(...args: unknown[]): void {
        errorLog(false, args);
    }

    export function warn(context: LogContext, message: string, error: unknown, payload: LogPayload): void;
    export function warn(context: LogContext, message: string, error: unknown): void;
    export function warn(context: LogContext, message: string, payload: LogPayload): void;
    export function warn(context: LogContext, message: string): void;
    export function warn(context: LogContext, error: unknown, payload: LogPayload): void;
    export function warn(context: LogContext, error: unknown): void;
    export function warn(message: string, error: unknown, payload: LogPayload): void;
    export function warn(message: string, error: unknown): void;
    export function warn(message: string, payload: LogPayload): void;
    export function warn(message: string): void;
    export function warn(error: unknown, payload: LogPayload): void;
    export function warn(error: unknown): void;
    export function warn(...args: unknown[]): void {
        warnLog(false, args);
    }

    export function info(context: LogContext, message: string, error: unknown, payload: LogPayload): void;
    export function info(context: LogContext, message: string, error: unknown): void;
    export function info(context: LogContext, message: string, payload: LogPayload): void;
    export function info(context: LogContext, message: string): void;
    export function info(context: LogContext, error: unknown, payload: LogPayload): void;
    export function info(context: LogContext, error: unknown): void;
    export function info(message: string, error: unknown, payload: LogPayload): void;
    export function info(message: string, error: unknown): void;
    export function info(message: string, payload: LogPayload): void;
    export function info(message: string): void;
    export function info(error: unknown, payload: LogPayload): void;
    export function info(error: unknown): void;
    export function info(...args: unknown[]): void {
        infoLog(false, args);
    }

    export function debug(context: LogContext, message: string, error: unknown, payload: LogPayload): void;
    export function debug(context: LogContext, message: string, error: unknown): void;
    export function debug(context: LogContext, message: string, payload: LogPayload): void;
    export function debug(context: LogContext, message: string): void;
    export function debug(context: LogContext, error: unknown, payload: LogPayload): void;
    export function debug(context: LogContext, error: unknown): void;
    export function debug(message: string, error: unknown, payload: LogPayload): void;
    export function debug(message: string, error: unknown): void;
    export function debug(message: string, payload: LogPayload): void;
    export function debug(message: string): void;
    export function debug(error: unknown, payload: LogPayload): void;
    export function debug(error: unknown): void;
    export function debug(...args: unknown[]): void {
        debugLog(false, args);
    }

    /**
     * Do not use in frontend.
     */
    export function enableJSONLogging(
        componentArg: string,
        versionArg: string | undefined,
        logLevel?: LogrusLogLevel,
    ): void {
        component = componentArg;
        version = versionArg;

        setLogLevel(logLevel);
    }

    export function setLogLevel(logLevel: LogrusLogLevel | undefined) {
        jsonLogging = true;

        console.error = function (...args: unknown[]): void {
            errorLog(true, args);
        };
        console.warn = function (...args: unknown[]): void {
            warnLog(true, args);
        };
        console.info = function (...args: unknown[]): void {
            infoLog(true, args);
        };
        console.debug = function (...args: unknown[]): void {
            debugLog(true, args);
        };

        console.log = console.info;
        // FIXME wrap also other console methods (e.g. trace())

        // set/unset log functions based on loglevel so we only have to evaluate once, not every call
        const noop = () => {};
        const setLog = (logFunc: DoLogFunction, funcLevel: LogrusLogLevel): DoLogFunction => {
            return LogrusLogLevel.isGreatherOrEqual(funcLevel, logLevel) ? logFunc : noop;
        };

        errorLog = setLog(doErrorLog, "error");
        warnLog = setLog(doWarnLog, "warning");
        infoLog = setLog(doInfoLog, "info");
        debugLog = setLog(doDebugLog, "debug");
    }

    export function resetToDefaultLogging(): void {
        jsonLogging = false;

        console.log = logConsoleLog;
        console.error = errorConsoleLog;
        console.warn = warnConsoleLog;
        console.info = infoConsoleLog;
        console.debug = debugConsoleLog;
    }

    export function setVersion(versionArg: string) {
        version = versionArg;
    }
}

type DoLogFunction = (calledViaConsole: boolean, args: unknown[]) => void;

let errorLog = doErrorLog;
function doErrorLog(calledViaConsole: boolean, args: unknown[]): void {
    doLog(calledViaConsole, errorConsoleLog, "ERROR", args);
}

let warnLog = doWarnLog;
function doWarnLog(calledViaConsole: boolean, args: unknown[]): void {
    doLog(calledViaConsole, warnConsoleLog, "WARNING", args);
}

let infoLog = doInfoLog;
function doInfoLog(calledViaConsole: boolean, args: unknown[]): void {
    doLog(calledViaConsole, infoConsoleLog, "INFO", args);
}

let debugLog = doDebugLog;
function doDebugLog(calledViaConsole: boolean, args: unknown[]): void {
    doLog(calledViaConsole, debugConsoleLog, "DEBUG", args);
}

// Ref: https://github.com/sirupsen/logrus#level-logging
export type LogrusLogLevel = keyof typeof LogrusLogLevels;
export const LogrusLogLevels = {
    trace: true,
    debug: true,
    info: true,
    warning: true,
    error: true,
    fatal: true,
    panic: true,
};
export namespace LogrusLogLevel {
    export function isGreatherOrEqual(lvl: LogrusLogLevel | undefined, ref: LogrusLogLevel | undefined): boolean {
        if (lvl === undefined) {
            return false;
        }
        if (ref === undefined) {
            return true;
        }
        return getLevelArity(lvl) >= getLevelArity(ref);
    }
    function getLevelArity(lvl: LogrusLogLevel): number {
        return Object.keys(LogrusLogLevels).findIndex((l) => l === lvl);
    }
    export function getFromEnv(): LogrusLogLevel | undefined {
        const lvlStr = process.env.LOG_LEVEL;
        if (!lvlStr) {
            return undefined;
        }
        const lvl = lvlStr as LogrusLogLevel;
        const exists = LogrusLogLevels[lvl];
        if (!exists) {
            return undefined;
        }
        return lvl;
    }
}

// Source: https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
type GoogleLogSeverity = "EMERGENCY" | "ALERT" | "CRITICAL" | "ERROR" | "WARNING" | "INFO" | "DEBUG";
namespace GoogleLogSeverity {
    export const isGreaterOrEqualThanWarning = (severity: GoogleLogSeverity) => {
        switch (severity) {
            case "INFO":
            case "DEBUG":
                return false;
            default:
                return true;
        }
    };
}

function doLog(calledViaConsole: boolean, consoleLog: ConsoleLog, severity: GoogleLogSeverity, args: unknown[]): void {
    if (!jsonLogging) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        consoleLog(...args);
        return;
    }

    if (args.length == 0) {
        // console.xyz()
        return;
    }

    let context: LogContext | undefined;
    let message: string | undefined;
    let error: Error | undefined;
    let payloadArgs: unknown[];

    if (args[0] instanceof Error) {
        // console.xyz(Error, ...any) / log.xyz(Error) / log.xyz(Error, LogPayload)
        error = args[0];
        payloadArgs = args.slice(1);
    } else if (typeof args[0] === "string") {
        message = args[0];
        if (args.length < 2 || !(args[1] instanceof Error)) {
            // console.xyz(string) / console.xyz(string, !Error, ...any) / log.xyz(string) / log.xyz(string, LogPayload)
            payloadArgs = args.slice(1);
        } else {
            // console.xyz(string, Error, ...any) / log.xyz(string, Error) / log.xyz(string, Error, LogPayload)
            error = args[1];
            payloadArgs = args.slice(2);
        }
    } else if (calledViaConsole || args.length < 2) {
        // console.xyz(!string & !Error, ...any) / wrong call of log.xyz (can happen when juggling with 'any'
        // or when passing, by mistake, log.xyz instead of console.xyz to third-party code as a callback (*))
        payloadArgs = args;
    } else {
        context = args[0] instanceof Object ? args[0] : undefined;
        if (args[1] instanceof Error) {
            // log.xyz(LogContext, Error) / log.xyz(LogContext, Error, LogPayload)
            error = args[1];
            payloadArgs = args.slice(2);
        } else if (typeof args[1] === "string") {
            message = args[1];
            if (args.length < 3 || !(args[2] instanceof Error)) {
                // log.xyz(LogContext, string) / log.xyz(LogContext, string, LogPayload)
                payloadArgs = args.slice(2);
            } else {
                // log.xyz(LogContext, string, Error) / log.xyz(LogContext, string, Error, LogPayload)
                error = args[2];
                payloadArgs = args.slice(3);
            }
        } else {
            // wrong call of log.xyz (see (*) above)
            context = undefined;
            payloadArgs = args;
        }
    }

    const logItem: string | undefined = makeLogItem(severity, context, message, error, payloadArgs, calledViaConsole);
    if (logItem !== undefined) {
        consoleLog(logItem);
    }
}

function makeLogItem(
    severity: GoogleLogSeverity,
    context: LogContext | undefined,
    message: string | undefined,
    error: Error | undefined,
    payloadArgs: unknown[],
    calledViaConsole: boolean,
): string | undefined {
    if (context !== undefined && Object.keys(context).length == 0) {
        context = undefined;
    }
    context = logContextAugmenter(context);
    context = scrubPayload(context, plainLogging);

    let reportedErrorEvent: {} = {};
    if (GoogleLogSeverity.isGreaterOrEqualThanWarning(severity)) {
        reportedErrorEvent = makeReportedErrorEvent(error);
    }

    payloadArgs = payloadArgs.map((arg) => scrubPayload(arg, plainLogging));
    const payload: unknown =
        payloadArgs.length == 0 ? undefined : payloadArgs.length == 1 ? payloadArgs[0] : payloadArgs;
    const logItem: LogItem = {
        // undefined fields get eliminated in JSON.stringify()
        ...reportedErrorEvent,
        component,
        severity,
        time: new Date().toISOString(),
        context,
        message,
        error,
        payload,
        loggedViaConsole: calledViaConsole ? true : undefined,
    };
    if (logItemHook) {
        try {
            logItemHook(logItem);
        } catch (err) {}
    }
    if (plainLogging) {
        return `[${logItem.severity}] [${logItem.component}] ${logItem.message}
            ${JSON.stringify(payload || "", undefined, "              ")}
            ${error || ""}
        `.trim();
    }
    let result: string = stringifyLogItem(logItem);

    if (result.length > maxAllowedLogItemLength && payload !== undefined) {
        delete logItem.payload;
        (<any>(
            logItem
        )).payloadStub = `Payload stripped as log item was longer than ${maxAllowedLogItemLength} characters`;

        result = stringifyLogItem(logItem);

        if (result.length <= maxAllowedLogItemLength) {
            log.warn("Log item too large, stripping payload", { logItemStub: makeLogItemStub(logItem) });
        }
    }
    if (result.length > maxAllowedLogItemLength) {
        log.error("Log item too large w/o payload, discarding", { logItemStub: makeLogItemStub(logItem) });
        return undefined;
    }

    return result;
}

function scrubPayload<T>(payload: T, plainLogging: boolean): T {
    if (plainLogging) {
        return payload;
    }
    return scrubber.scrub(payload, false);
}

// See https://cloud.google.com/error-reporting/docs/formatting-error-messages
// and https://cloud.google.com/error-reporting/reference/rest/v1beta1/projects.events/report#ReportedErrorEvent
function makeReportedErrorEvent(error: Error | undefined): {} {
    const result = {
        // Serves as marker only
        "@type": "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
        // This is useful for filtering in the UI
        serviceContext: {
            service: component || "<ts-not-set>",
            version: version || "<ts-not-set>",
        },

        // According to: https://cloud.google.com/error-reporting/docs/formatting-error-messages#json_representation
        stack_trace: error?.stack,
    };

    return result;
}

type LogItem = {
    component?: string;
    severity: string;
    time?: string;
    context?: LogContext;
    environment?: string;
    region?: string;
    message?: string;
    messageStub?: string;
    errorStub?: string;
    error?: unknown;
    payload?: unknown;
    loggedViaConsole?: boolean;
};

function makeLogItemStub(logItem: LogItem): LogItem {
    const result = <LogItem>{
        component: logItem.component,
        severity: logItem.severity,
        time: logItem.time,
        environment: logItem.environment,
        region: logItem.region,
    };
    if (typeof logItem.message === "string") {
        if (logItem.message.length <= maxMessageStubLength) {
            result.message = logItem.message;
        } else {
            result.messageStub = logItem.message.substring(0, maxMessageStubLength) + " ... (too long, truncated)";
        }
    }
    if (logItem.error instanceof Error && logItem.error.stack) {
        if (logItem.error.stack.length <= maxErrorStubLength) {
            result.error = logItem.error.stack;
        } else {
            result.errorStub = logItem.error.stack.substring(0, maxErrorStubLength) + " ... (too long, truncated)";
        }
    }
    return result;
}

function stringifyLogItem(logItem: LogItem): string {
    try {
        return jsonStringifyWithErrors(logItem);
    } catch (err) {
        if (err instanceof TypeError && logItem.payload !== undefined) {
            // payload contains circular references: save it as a string in the form console.xyz() would print
            logItem.payload = inspect(logItem.payload);
            return jsonStringifyWithErrors(logItem);
        }
        throw err;
    }
}

/**
 * Jsonifies Errors properly, not as {} only.
 */
function jsonStringifyWithErrors(value: unknown): string {
    return JSON.stringify(value, (_, value) => {
        return value instanceof Error ? value.stack : value;
    });
}

type ConsoleLog = (message?: unknown, ...optionalArgs: unknown[]) => void; // signature of console.xyz
const logConsoleLog: ConsoleLog = console.log;
const errorConsoleLog: ConsoleLog = console.error;
const warnConsoleLog: ConsoleLog = console.warn;
const infoConsoleLog: ConsoleLog = console.info;
const debugConsoleLog: ConsoleLog = console.debug;

// according to https://cloud.google.com/logging/quotas#logging_usage_limits, the log item must fit in 100 KB (internal data
// size; its relation to the stringified JSON's size is unknown), so let's have a sufficient safe margin
const maxAllowedLogItemLength: number = 32 * 1024;
const maxMessageStubLength: number = 1024;
const maxErrorStubLength: number = 4096;
