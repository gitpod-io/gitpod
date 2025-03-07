const { execSync } = require("child_process");

const getIDToken = async () => {
    return new Promise((resolve, reject) => {
        try {
            try {
                const token = execSync("gitpod idp token --audience accounts.google.com", { encoding: "utf8" }).trim();
                resolve(token);
            } catch (error) {
                reject(new Error("Error getting token: " + error.message));
            }
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
