/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { inject, injectable } from "inversify";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";

@injectable()
export class NewsletterSubscriptionController {
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;

    get apiRouter(): express.Router {
        const router = express.Router();

        router.get("/unsubscribe", async (req: express.Request, res: express.Response) => {
            const email: string = req.query.email;
            const newsletterType: string = req.query.type;
            const acceptedNewsletterTypes: string[] = ["changelog", "devx"];
            const newsletterProperties: {[key:string]: {[key: string]: string}} = {
                changelog: {
                    property: "unsubscribed_changelog",
                    value: "allowsChangelogMail"
                },
                devx: {
                    property: "unsubscribed_devx",
                    value: "allowsDevXMail"
                }
            }

            if (!acceptedNewsletterTypes.includes(newsletterType)) {
                res.sendStatus(422);
                return;
            }

            try {
                // Not all newsletter subscribers are users,
                // therefore the email address is our starting point
                const user = (await this.userDb.findUsersByEmail(email))[0];
                const successPageUrl: string = 'https://www.gitpod.io/unsubscribe';

                if (user && user.additionalData && user.additionalData.emailNotificationSettings) {
                    await this.userDb.updateUserPartial({
                        ...user,
                        additionalData: {
                            ...user.additionalData,
                            emailNotificationSettings: {
                                ...user.additionalData.emailNotificationSettings,
                                [newsletterProperties[newsletterType].value]: false
                            }
                        }
                    });
                    this.analytics.track({
                        userId: user.id,
                        event: "notification_change",
                        properties: {
                            [newsletterProperties[newsletterType].property]: true
                        }
                    });
                    res.redirect(successPageUrl);
                }

                else {
                    this.analytics.identify({
                        userId: email,
                        traits: {
                            [newsletterProperties[newsletterType].property]: true
                        }
                    });
                    res.redirect(successPageUrl);
                }
            } catch (error) {
                res.send({
                    err: error.status,
                    message: error.message
                });
                return;
            }
        })

        return router;
    }
}