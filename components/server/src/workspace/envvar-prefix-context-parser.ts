/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IPrefixContextParser } from "./context-parser";
import { User, WorkspaceContext, WithEnvvarsContext } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";
import { EnvVarWithValue } from "@gitpod/gitpod-protocol/lib/protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class EnvvarPrefixParser implements IPrefixContextParser {
    public findPrefix(user: User, context: string): string | undefined {
        const result = this.parse(context);
        return result && result.prefix;
    }

    public async handle(user: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext> {
        const result = this.parse(prefix);
        if (!result) {
            return context;
        }

        const envvars: EnvVarWithValue[] = [];
        for (const [k, v] of result.envVarMap.entries()) {
            const decodedValue = decodeURIComponent(v);

            // Always validate environment variables for security
            const validation = EnvvarSanitization.validateContextEnvVar(k, decodedValue);
            if (!validation.valid) {
                log.warn({ userId: user.id }, "Blocked environment variable via context URL", {
                    reason: validation.reason,
                    error: validation.error,
                    reasonDescription: validation.reason
                        ? EnvvarSanitization.getBlockReasonDescription(validation.reason)
                        : undefined,
                });
                continue;
            }

            envvars.push({ name: k, value: decodeURIComponent(v) });
        }
        return <WithEnvvarsContext>{
            ...context,
            envvars,
        };
    }

    protected parse(ctx: string) {
        const splitBySlash = ctx.split("/");
        if (splitBySlash.length < 2) {
            return; // "/" not found
        }
        const envVarMap = new Map<string, string>();
        const prefix = splitBySlash[0];
        const kvCandidates = prefix.split(",");
        for (const kvCandidate of kvCandidates) {
            const kv = kvCandidate.split("=");
            if (kv.length !== 2 || !kv[0] || !kv[1] || !kv[0].match(/^[\w-_]+$/)) {
                continue;
            }
            envVarMap.set(kv[0], kv[1]);
        }
        if (envVarMap.size === 0) {
            return undefined;
        }
        return {
            prefix: prefix + "/",
            envVarMap,
        };
    }
}

/**
 * Security validation for environment variables set via context URLs.
 *
 * Implements a three-layer security approach:
 * 1. Variable name blacklist - blocks auto-executing variables
 * 2. Character whitelist - restricts values to safe characters
 * 3. Injection pattern detection - detects code injection attempts
 *
 * This addresses CLC-1591: Environment Variable Injection vulnerability
 */
export namespace EnvvarSanitization {
    // Layer 1: Auto-executing variables that automatically execute code
    const AUTO_EXEC_VARIABLES = new Set([
        // Shell execution variables
        "BASH_ENV",
        "ENV",
        "PROMPT_COMMAND",
        "PS0",
        "PS1",
        "PS2",
        "PS3",
        "PS4",
        "ZDOTDIR",
        // Dynamic linker variables
        "LD_PRELOAD",
        "LD_LIBRARY_PATH",
        "LD_AUDIT",
        "LD_DEBUG",
        "LD_PROFILE",
        // Language runtime variables
        "PYTHONSTARTUP",
        "PYTHONPATH",
        "PERL5LIB",
        "PERL5OPT",
        "NODE_OPTIONS",
        // System path variables
        "PATH",
        "CDPATH",
        "SHELL",
        "IFS",
        // Gitpod specific variables
        "SUPERVISOR_DOTFILE_REPO",
    ]);

    // Layer 1b: Pattern-based variable blocking for dangerous variable families
    const DANGEROUS_VAR_PATTERNS = [
        /^LD_/, // All dynamic linker variables
        /^PYTHON/, // All Python runtime variables
        /^PERL/, // All Perl runtime variables
        /^JAVA_/, // All Java runtime variables
        /^NODE_/, // All Node.js runtime variables
        /^GIT_/, // All Git configuration variables
        /.*_(PATH|HOME|CONFIG|OPTIONS|STARTUP|INIT)$/, // Path and configuration variables
        /^(GITPOD|SUPERVISOR)_/, // Gitpod internal variables
    ];

    // Layer 2: Character whitelist - only allow safe characters in values
    const SAFE_VALUE_PATTERN = /^[A-Za-z0-9_\-\.?=]*$/;

    // Layer 3: Injection patterns - detect obvious code injection attempts
    const INJECTION_PATTERNS = [
        /\$\(/, // Command substitution $(...)
        /`/, // Backtick command substitution
        /\|\s*\w/, // Pipe to command
        /;\s*\w/, // Command separator
        /&&\s*\w/, // Command chaining
        /\|\|\s*\w/, // Command chaining
        />\s*\w/, // Output redirection
        /<\s*\w/, // Input redirection
    ];

    /**
     * Result of environment variable security validation
     */
    export interface ValidationResult {
        /** Whether the variable is safe to set */
        valid: boolean;
        /** Error message if validation failed */
        error?: string;
        /** Specific reason for validation failure */
        reason?: ValidationFailureReason;
    }

    /**
     * Specific reasons why validation might fail
     */
    export type ValidationFailureReason = "auto-exec" | "pattern-match" | "unsafe-chars" | "injection-pattern";

    /**
     * Validates an environment variable name and value for security.
     *
     * @param name The environment variable name
     * @param value The environment variable value (should be URL-decoded)
     * @returns ValidationResult indicating if the variable is safe to set
     */
    export function validateContextEnvVar(name: string, value: string): ValidationResult {
        // Layer 1: Check auto-executing variable names
        if (AUTO_EXEC_VARIABLES.has(name)) {
            return {
                valid: false,
                error: `Variable '${name}' cannot be set via context URL (auto-executes code)`,
                reason: "auto-exec",
            };
        }

        // Layer 1b: Check dangerous variable patterns
        for (const pattern of DANGEROUS_VAR_PATTERNS) {
            if (pattern.test(name)) {
                return {
                    valid: false,
                    error: `Variable '${name}' cannot be set via context URL (matches dangerous pattern)`,
                    reason: "pattern-match",
                };
            }
        }

        // Layer 2: Check character whitelist
        if (!SAFE_VALUE_PATTERN.test(value)) {
            return {
                valid: false,
                error: `Value contains unsafe characters. Only [A-Za-z0-9_\\-\\.?=] allowed`,
                reason: "unsafe-chars",
            };
        }

        // Layer 3: Check for injection patterns
        for (const pattern of INJECTION_PATTERNS) {
            if (pattern.test(value)) {
                return {
                    valid: false,
                    error: `Value contains potential code injection pattern`,
                    reason: "injection-pattern",
                };
            }
        }

        return { valid: true };
    }

    /**
     * Get a human-readable description of why a variable was blocked.
     * Useful for logging and user feedback.
     */
    export function getBlockReasonDescription(reason: ValidationFailureReason): string {
        switch (reason) {
            case "auto-exec":
                return "Variable automatically executes code when set";
            case "pattern-match":
                return "Variable name matches dangerous pattern";
            case "unsafe-chars":
                return "Value contains unsafe characters";
            case "injection-pattern":
                return "Value contains potential code injection";
            default:
                return "Unknown validation failure";
        }
    }
}
