const fs = require("fs");
import * as path from "path";

export function renderPayment(
    namespace: string,
    paymentEndpointVersion: String,
    serviceAwaiterVersion: string,
): string {
    const output: string[] = [];
    for (const file of fs.readdirSync(__dirname)) {
        if (!file.endsWith(".yaml")) {
            continue;
        }
        let content = fs.readFileSync(path.join(__dirname, file), { encoding: "utf-8" });
        content = content
            .replaceAll("${NAMESPACE}", namespace)
            .replaceAll("${PAYMENT_ENDPOINT_VERSION}", paymentEndpointVersion)
            .replaceAll("${SERVICE_WAITER_VERSION}", serviceAwaiterVersion);
        output.push(content);
    }
    return output.join("\n---\n");
}
