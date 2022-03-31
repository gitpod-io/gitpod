import * as configcat from "configcat-node";
import { IConfigCatClient } from "configcat-common/lib/ConfigCatClient";

// Seeing all log messages makes the first integration easier. When the integration is done you can remove this line to avoid too detailed logging in your application.
let logger = configcat.createConsoleLogger(3); // Setting log level to 3 (Info)
let client: IConfigCatClient | undefined;

export function getConfigcatClient(): IConfigCatClient {
    if (client === undefined) {
        client = configcat.createClient("WBLaCPtkjkqKHlHedziE9g/LEAOCNkbuUKiqUZAcVg7dw", {
            // <-- This is the actual SDK Key for your Test environment
            logger: logger,
        });
    }

    return client;
}
