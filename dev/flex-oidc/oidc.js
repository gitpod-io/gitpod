const fs = require("fs");
const http2 = require("http2");

const getIDToken = async () => {
    return new Promise((resolve, reject) => {
        try {
            const configPath = "/usr/local/gitpod/config/initial-spec.json";
            const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

            const controlPlaneApiEndpoint = config.controlPlaneApiEndpoint;
            const environmentToken = config.environmentToken;

            const url = new URL(controlPlaneApiEndpoint);
            const client = http2.connect(url.origin);

            const req = client.request({
                ":method": "POST",
                "content-type": "application/json",
                authorization: `Bearer ${environmentToken}`,
                ":path": `${url.pathname}/gitpod.v1.IdentityService/GetIDToken`,
            });

            let responseData = "";

            req.on("data", (chunk) => {
                responseData += chunk;
            });

            req.on("end", () => {
                try {
                    const result = JSON.parse(responseData);
                    const token = result.token;
                    resolve(token);
                } catch (error) {
                    reject(new Error("Error parsing response: " + error.message));
                } finally {
                    client.close();
                }
            });

            req.on("error", (error) => {
                reject(new Error(error.message));
                client.close();
            });

            req.end(
                JSON.stringify({
                    audience: ["accounts.google.com"],
                }),
            );
        } catch (e) {
            reject(new Error(e.message));
        }
    });
};

(async () => {
    try {
        const token = await getIDToken();
        console.log(
            JSON.stringify({
                version: 1,
                success: true,
                token_type: "urn:ietf:params:oauth:token-type:id_token",
                id_token: token,
            }),
        );
    } catch (error) {
        console.log(
            JSON.stringify({
                version: 1,
                success: false,
                code: "401",
                message: error.message,
            }),
        );
    }
})();
