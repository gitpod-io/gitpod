/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { WorkspaceTimeoutDuration } from "./gitpod-service";

describe("WorkspaceTimeoutDuration", () => {
    describe("validate", () => {
        it("should handle single unit durations correctly", () => {
            expect(WorkspaceTimeoutDuration.validate("30m")).to.equal("30m");
            expect(WorkspaceTimeoutDuration.validate("60m")).to.equal("60m");
            expect(WorkspaceTimeoutDuration.validate("90m")).to.equal("90m");
            expect(WorkspaceTimeoutDuration.validate("1h")).to.equal("1h");
            expect(WorkspaceTimeoutDuration.validate("2h")).to.equal("2h");
        });

        it("should handle mixed unit durations correctly (bug fix)", () => {
            // These were the bug cases that were incorrectly parsed
            expect(WorkspaceTimeoutDuration.validate("1h30m")).to.equal("1h30m");
            expect(WorkspaceTimeoutDuration.validate("2h15m")).to.equal("2h15m");
            expect(WorkspaceTimeoutDuration.validate("3h45m")).to.equal("3h45m");
            expect(WorkspaceTimeoutDuration.validate("1h1m")).to.equal("1h1m");
            expect(WorkspaceTimeoutDuration.validate("2h59m")).to.equal("2h59m");
        });

        it("should handle complex Go duration formats", () => {
            expect(WorkspaceTimeoutDuration.validate("1h30m45s")).to.equal("1h30m45s");
            expect(WorkspaceTimeoutDuration.validate("1m30s")).to.equal("1m30s");
            // Note: parse-duration doesn't support decimal durations like "1.5h"
        });

        it("should handle edge cases within limits", () => {
            expect(WorkspaceTimeoutDuration.validate("24h")).to.equal("24h");
            expect(WorkspaceTimeoutDuration.validate("23h59m")).to.equal("23h59m");
            expect(WorkspaceTimeoutDuration.validate("1440m")).to.equal("1440m"); // 24 hours in minutes
        });

        it("should reject durations exceeding 24 hours", () => {
            expect(() => WorkspaceTimeoutDuration.validate("25h")).to.throw(
                "Workspace inactivity timeout cannot exceed 24h",
            );
            expect(() => WorkspaceTimeoutDuration.validate("1441m")).to.throw(
                "Workspace inactivity timeout cannot exceed 24h",
            );
            expect(() => WorkspaceTimeoutDuration.validate("24h1m")).to.throw(
                "Workspace inactivity timeout cannot exceed 24h",
            );
        });

        it("should reject invalid formats", () => {
            expect(() => WorkspaceTimeoutDuration.validate("invalid")).to.throw("Invalid timeout format");
            expect(() => WorkspaceTimeoutDuration.validate("1x")).to.throw("Invalid timeout format");
            expect(() => WorkspaceTimeoutDuration.validate("")).to.throw("Invalid timeout format");
            expect(() => WorkspaceTimeoutDuration.validate("1")).to.throw("Invalid timeout format");
        });

        it("should handle case insensitivity", () => {
            expect(WorkspaceTimeoutDuration.validate("1H30M")).to.equal("1h30m");
            expect(WorkspaceTimeoutDuration.validate("90M")).to.equal("90m");
        });

        it("should reject zero or negative durations", () => {
            // Note: Go duration format doesn't support negative durations in the format we accept
            // Zero duration components are handled by the totalMinutes > 0 check
            expect(() => WorkspaceTimeoutDuration.validate("0m")).to.throw("Invalid timeout value");
            expect(() => WorkspaceTimeoutDuration.validate("0h")).to.throw("Invalid timeout value");
        });
    });
});
