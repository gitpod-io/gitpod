import * as https from 'https';

export function reportBuildFailureInSlack(context, err, onErr) {
    const repo = context.Repository.host + '/' + context.Repository.owner + '/' + context.Repository.repo;
    const data = JSON.stringify({
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: ':X: *build failure*\n_Repo:_ `' + repo + '`\n_Build:_ `' + context.Name + '`',
                },
                accessory: {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'Go to Werft',
                        emoji: true,
                    },
                    value: 'click_me_123',
                    url: 'https://werft.gitpod-dev.com/job/' + context.Name,
                    action_id: 'button-action',
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '```\n' + err + '\n```',
                },
            },
        ],
    });
    const req = https.request(
        {
            hostname: 'hooks.slack.com',
            port: 443,
            path: process.env.SLACK_NOTIFICATION_PATH.trim(),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
            },
        },
        onErr,
    );
    req.on('error', onErr);
    req.write(data);
    req.end();
}
