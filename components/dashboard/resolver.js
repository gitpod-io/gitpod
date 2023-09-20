/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/*
 * Resolver allows to reconstruct stack traces from obfuscated stack traces for the dashboard.
 * Usage:
 *  node resolver.js < obfuscated-stack-trace.txt
 *
 * OR
 *
 *  node resolver.js <<EOF
 *  obfuscated stack trace
 *  EOF
 */

//@ts-check
const path = require("path");
const fetch = require("node-fetch").default;
const { SourceMapConsumer } = require("source-map");

const sourceMapCache = {};

function extractJsUrlFromLine(line) {
    const match = line.match(/https?:\/\/[^\s]+\.js/);
    return match ? match[0] : null;
}

async function fetchSourceMap(jsUrl) {
    // Use cached source map if available
    if (sourceMapCache[jsUrl]) {
        return sourceMapCache[jsUrl];
    }

    const jsResponse = await fetch(jsUrl);
    const jsContent = await jsResponse.text();

    // Extract source map URL from the JS file
    const mapUrlMatch = jsContent.match(/\/\/#\s*sourceMappingURL=(.+)/);
    if (!mapUrlMatch) {
        throw new Error("Source map URL not found");
    }

    const mapUrl = new URL(mapUrlMatch[1], jsUrl).href; // Resolve relative URL
    const mapResponse = await fetch(mapUrl);
    const mapData = await mapResponse.json();

    // Cache the fetched source map
    sourceMapCache[jsUrl] = mapData;

    return mapData;
}

const BASE_PATH = "/workspace/gitpod/components";

async function resolveLine(line) {
    const jsUrl = extractJsUrlFromLine(line);
    if (!jsUrl) return line;

    const rawSourceMap = await fetchSourceMap(jsUrl);
    const matches = line.match(/at (?:([\S]+) )?\(?(https?:\/\/[^\s]+\.js):(\d+):(\d+)\)?/);

    if (!matches) {
        return line;
    }

    const functionName = matches[1] || "";
    const lineNum = Number(matches[3]);
    const colNum = Number(matches[4]);

    const consumer = new SourceMapConsumer(rawSourceMap);
    const originalPosition = consumer.originalPositionFor({ line: lineNum, column: colNum });

    if (originalPosition && originalPosition.source) {
        const fullPath = path.join(BASE_PATH, originalPosition.source);
        const originalFunctionName = originalPosition.name || functionName;
        return `    at ${originalFunctionName} (${fullPath}:${originalPosition.line}:${originalPosition.column})`;
    }

    return line;
}

let obfuscatedTrace = "";

process.stdin.on("data", function (data) {
    obfuscatedTrace += data;
});

process.stdin.on("end", async function () {
    const lines = obfuscatedTrace.split("\n");
    const resolvedLines = await Promise.all(lines.map(resolveLine));
    const resolvedTrace = resolvedLines.join("\n");
    console.log("\nResolved Stack Trace:\n");
    console.log(resolvedTrace);
});

if (process.stdin.isTTY) {
    console.error("Please provide the obfuscated stack trace either as a multi-line input or from a file.");
    process.exit(1);
}
