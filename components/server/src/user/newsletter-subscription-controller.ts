/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { inject, injectable } from "inversify";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

interface SubscriptionData {
    email: string
    context: string
    trackingId?: string
    newsletterType: string
}

namespace SubscriptionData {
    export function is(o: any): o is SubscriptionData {
        return o !== undefined &&
            typeof o.email === "string" &&
            typeof o.context === "string" &&
            typeof o.newsletterType === "string" &&
            (o.trackingId == undefined || typeof o.trackingId === "string");
    }
}

@injectable()
export class NewsletterSubscriptionController {
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;

    get apiRouter(): express.Router {
        const acceptedNewsletterTypes: string[] = ["changelog", "devx", "onboarding"];
        const newsletterProperties: {[key:string]: {[key: string]: string}} = {
            changelog: {
                property: "unsubscribed_changelog",
                value: "allowsChangelogMail"
            },
            devx: {
                property: "unsubscribed_devx",
                value: "allowsDevXMail"
            },
            onboarding: {
                property: "unsubscribed_onboarding",
                value: "allowsOnboardingMail"
            }
        }

        const router = express.Router();

        router.get("/unsubscribe", async (req: express.Request, res: express.Response) => {
            const email: string = req.query.email;
            const newsletterType: string = req.query.type;

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
                    this.analytics.identify({
                        userId: user.id,
                        traits: {
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

        router.post("/subscribe", async (req: express.Request, res: express.Response) => {
            try {
                const data = JSON.parse(req.body);
                if (!SubscriptionData.is(data)) {
                    res.status(400).send('Invalid message body');
                    log.error("Invalid subscribe request", data)
                    return;
                }
                if (!acceptedNewsletterTypes.includes(data.newsletterType)) {
                    log.error("Invalid newsletter in subscribe request", data)
                    res.status(400).send('Invalid newsletter type');
                    return;
                }
                const user = (await this.userDb.findUsersByEmail(data.email))[0];
                if (user && user.additionalData && user.additionalData.emailNotificationSettings) {
                    await this.userDb.updateUserPartial({
                        ...user,
                        additionalData: {
                            ...user.additionalData,
                            emailNotificationSettings: {
                                ...user.additionalData.emailNotificationSettings,
                                [newsletterProperties[data.newsletterType].value]: true
                            }
                        }
                    });
                    this.analytics.identify({
                        userId: user.id,
                        traits: {
                            [newsletterProperties[data.newsletterType].property]: false
                        }
                    });
                } else {
                    this.analytics.identify({
                        userId: data.email,
                        anonymousId: data.trackingId,
                        traits: {
                            [newsletterProperties[data.newsletterType].property]: false
                        }
                    });
                }
                res.send({
                    message: `Successfully subscribed ${data.email} to newsletter ${data.newsletterType}`
                });
            } catch (error) {
                res.status(400)
                log.error("Invalid newsletter in subscribe request", error)
                return;
            }
        })

        return router;
    }
}