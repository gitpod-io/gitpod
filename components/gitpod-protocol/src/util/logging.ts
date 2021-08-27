/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const inspect: (object: any) => string = require('util').inspect;   // undefined in frontend

let jsonLogging: boolean = false;
let component: string | undefined;
let version: string | undefined;

export interface LogContext {
    instanceId?: string;
    sessionId?: string;
    userId?: string;
    workspaceId?: string;
};
export namespace LogContext {
    export function from(params : { userId?: string, user?: any, request?: any } ) {
        return <LogContext>{
            sessionId: params.request?.requestID,
            userId: params.userId || params.user?.id
        }
    }
}

export interface LogPayload {
    // placeholder to indicate that only dictionary-style objects should be passed as payload
};

export namespace log {
    export function error(context: LogContext, message: string, error: Error, payload: LogPayload): void;
    export function error(context: LogContext, message: string, error: Error): void;
    export function error(context: LogContext, message: string, payload: LogPayload): void;
    export function error(context: LogContext, message: string): void;
    export function error(context: LogContext, error: Error, payload: LogPayload): void;
    export function error(context: LogContext, error: Error): void;
    export function error(message: string, error: Error, payload: LogPayload): void;
    export function error(message: string, error: Error): void;
    export function error(message: string, payload: LogPayload): void;
    export function error(message: string): void;
    export function error(error: Error, payload: LogPayload): void;
    export function error(error: Error): void;
    export function error(...args: any[]): void {
        errorLog(false, args);
    }

    export function warn(context: LogContext, message: string, error: Error, payload: LogPayload): void;
    export function warn(context: LogContext, message: string, error: Error): void;
    export function warn(context: LogContext, message: string, payload: LogPayload): void;
    export function warn(context: LogContext, message: string): void;
    export function warn(context: LogContext, error: Error, payload: LogPayload): void;
    export function warn(context: LogContext, error: Error): void;
    export function warn(message: string, error: Error, payload: LogPayload): void;
    export function warn(message: string, error: Error): void;
    export function warn(message: string, payload: LogPayload): void;
    export function warn(message: string): void;
    export function warn(error: Error, payload: LogPayload): void;
    export function warn(error: Error): void;
    export function warn(...args: any[]): void {
        warnLog(false, args);
    }

    export function info(context: LogContext, message: string, error: Error, payload: LogPayload): void;
    export function info(context: LogContext, message: string, error: Error): void;
    export function info(context: LogContext, message: string, payload: LogPayload): void;
    export function info(context: LogContext, message: string): void;
    export function info(context: LogContext, error: Error, payload: LogPayload): void;
    export function info(context: LogContext, error: Error): void;
    export function info(message: string, error: Error, payload: LogPayload): void;
    export function info(message: string, error: Error): void;
    export function info(message: string, payload: LogPayload): void;
    export function info(message: string): void;
    export function info(error: Error, payload: LogPayload): void;
    export function info(error: Error): void;
    export function info(...args: any[]): void {
        infoLog(false, args);
    }

    export function debug(context: LogContext, message: string, error: Error, payload: LogPayload): void;
    export function debug(context: LogContext, message: string, error: Error): void;
    export function debug(context: LogContext, message: string, payload: LogPayload): void;
    export function debug(context: LogContext, message: string): void;
    export function debug(context: LogContext, error: Error, payload: LogPayload): void;
    export function debug(context: LogContext, error: Error): void;
    export function debug(message: string, error: Error, payload: LogPayload): void;
    export function debug(message: string, error: Error): void;
    export function debug(message: string, payload: LogPayload): void;
    export function debug(message: string): void;
    export function debug(error: Error, payload: LogPayload): void;
    export function debug(error: Error): void;
    export function debug(...args: any[]): void {
        debugLog(false, args);
    }

    /**
     * Do not use in frontend.
     */
    export function enableJSONLogging(componentArg: string, versionArg: string | undefined): void {
        component = componentArg;
        version = versionArg;

        jsonLogging = true;

        console.error = function (...args: any[]): void {
            errorLog(true, args);
        }
        console.warn = function (...args: any[]): void {
            warnLog(true, args);
        }
        console.info = function (...args: any[]): void {
            infoLog(true, args);
        }
        console.debug = function (...args: any[]): void {
            debugLog(true, args);
        }
        console.log = console.info;
        // FIXME wrap also other console methods (e.g. trace())
    }

    export function resetToDefaultLogging(): void {
        jsonLogging = false;

        console.log = logConsoleLog;
        console.error = errorConsoleLog;
        console.warn = warnConsoleLog;
        console.info = infoConsoleLog;
        console.debug = debugConsoleLog;
    }
}

function errorLog(calledViaConsole: boolean, args: any[]): void {
    doLog(calledViaConsole, errorConsoleLog, 'ERROR', args);
}

function warnLog(calledViaConsole: boolean, args: any[]): void {
    doLog(calledViaConsole, warnConsoleLog, 'WARNING', args);
}

function infoLog(calledViaConsole: boolean, args: any[]): void {
    doLog(calledViaConsole, infoConsoleLog, 'INFO', args);
}

function debugLog(calledViaConsole: boolean, args: any[]): void {
    doLog(calledViaConsole, debugConsoleLog, 'DEBUG', args);
}

// Source: https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
type GoogleLogSeverity = 'EMERGENCY' | 'ALERT' | 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';
namespace GoogleLogSeverity {
    export const isGreaterOrEqualThanWarning = (severity: GoogleLogSeverity) => {
        switch (severity) {
            case 'INFO':
            case 'DEBUG':
                return false;
            default:
                return true;
        }
    };
}

function doLog(calledViaConsole: boolean, consoleLog: ConsoleLog, severity: GoogleLogSeverity, args: any[]): void {
    if (!jsonLogging) {
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
    let payloadArgs: any[];

    if (args[0] instanceof Error) {
        // console.xyz(Error, ...any) / log.xyz(Error) / log.xyz(Error, LogPayload)
        error = args[0];
        payloadArgs = args.slice(1);
    } else if (typeof args[0] === 'string') {
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
        context = args[0];
        if (args[1] instanceof Error) {
            // log.xyz(LogContext, Error) / log.xyz(LogContext, Error, LogPayload)
            error = args[1];
            payloadArgs = args.slice(2);
        } else if (typeof args[1] === 'string') {
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

function makeLogItem(severity: GoogleLogSeverity, context: LogContext | undefined, message: string | undefined,
        error: Error | undefined, payloadArgs: any[], calledViaConsole: boolean): string | undefined {

    if (context !== undefined && Object.keys(context).length == 0) {
        context = undefined;
    }

    let reportedErrorEvent: {} = {};
    if (GoogleLogSeverity.isGreaterOrEqualThanWarning(severity)) {
        reportedErrorEvent = makeReportedErrorEvent(error);
    }

    const payload: any = payloadArgs.length == 0 ? undefined : payloadArgs.length == 1 ? payloadArgs[0] : payloadArgs;
    const logItem: any = {
        // undefined fields get eliminated in JSON.stringify()
        ...reportedErrorEvent,
        component,
        severity,
        time: new Date().toISOString(),
        environment: process.env.KUBE_STAGE,
        context,
        message,
        error,
        payload,
        loggedViaConsole: calledViaConsole ? true : undefined
    };
    let result: string = stringifyLogItem(logItem);

    if (result.length > maxAllowedLogItemLength && payload !== undefined) {
        delete logItem.payload;
        logItem.payloadStub = `Payload stripped as log item was longer than ${maxAllowedLogItemLength} characters`;

        result = stringifyLogItem(logItem);

        if (result.length <= maxAllowedLogItemLength) {
            log.warn('Log item too large, stripping payload', { logItemStub: makeLogItemStub(logItem) });
        }
    }
    if (result.length > maxAllowedLogItemLength) {
        log.error('Log item too large w/o payload, discarding', { logItemStub: makeLogItemStub(logItem) });
        return undefined;
    }

    return result;
}

// See https://cloud.google.com/error-reporting/docs/formatting-error-messages
// and https://cloud.google.com/error-reporting/reference/rest/v1beta1/projects.events/report#ReportedErrorEvent
function makeReportedErrorEvent(error: Error | undefined) {
    const result: any = {
        // Serves as marker only
        "@type": "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
        // This is useful for filtering in the UI
        "serviceContext": {
            "service": component || "<ts-not-set>",
            "version": version || "<ts-not-set>",
        }
    };

    if (error) {
        // According to: https://cloud.google.com/error-reporting/docs/formatting-error-messages#json_representation
        const stackTrace = error.stack;
        if (stackTrace) {
            result.stack_trace = stackTrace;
        }
    }

    return result;
}

function makeLogItemStub(logItem: any): any {
    const result: any = {
        component: logItem.component,
        severity: logItem.severity,
        time: logItem.time,
        environment: logItem.environment,
        region: logItem.region
    };
    if (typeof (logItem.message) === 'string') {
        if (logItem.message.length <= maxMessageStubLength) {
            result.message = logItem.message;
        } else {
            result.messageStub = logItem.message.substring(0, maxMessageStubLength) + " ... (too long, truncated)";
        }
    }
    if (logItem.error instanceof Error) {
        if (logItem.error.stack.length <= maxErrorStubLength) {
            result.error = logItem.error.stack;
        } else {
            result.errorStub = logItem.error.stack.substring(0, maxErrorStubLength) + " ... (too long, truncated)";
        }
    }
    return result;
}

function stringifyLogItem(logItem: any): string {
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
function jsonStringifyWithErrors(value: any): string {
    return JSON.stringify(value, (key: string, value: any): any => { return value instanceof Error ? value.stack : value });
}

type ConsoleLog = (message?: any, ...optionalArgs: any[]) => void;  // signature of console.xyz
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
