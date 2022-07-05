import * as https from "https";

export function reportBuildFailureInSlack(context, err: Error): Promise<void> {
    const repo = context.Repository.host + "/" + context.Repository.owner + "/" + context.Repository.repo;
    const data = JSON.stringify({
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: ":X: *build failure*\n_Repo:_ `" + repo + "`\n_Build:_ `" + context.Name + "`",
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Go to Werft",
                        emoji: true,
                    },
                    value: "click_me_123",
                    url: "https://werft.gitpod-dev.com/job/" + context.Name,
                    action_id: "button-action",
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "```\n" + err + "\n```",
                },
            },
        ],
    });
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: "hooks.slack.com",
                port: 443,
                path: process.env.SLACK_NOTIFICATION_PATH.trim(),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": data.length,
                },
            },
            () => resolve(),
        );
        req.on("error", (error: Error) => reject(error));
        req.write(data);
        req.end();
    });
}

export function reportCertificateError(options: { certificateName: string; certifiateYAML: string }): Promise<void> {
    const data = JSON.stringify({
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `A build failed because the certificate ${options.certificateName} never reached the Ready state. @team-platform please investigate using our [Debugging certificate issues guide](https://www.notion.so/gitpod/Debugging-certificate-issues-9453d1c8ac914ce7962557b67f7b49b3) :hug:`,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "```\n" + options.certifiateYAML + "\n```",
                },
            },
        ],
    });
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: "hooks.slack.com",
                port: 443,
                path: process.env.SLACK_NOTIFICATION_PATH.trim(),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": data.length,
                },
            },
            () => resolve(),
        );
        req.on("error", (error: Error) => reject(error));
        req.write(data);
        req.end();
    });
}
