/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from 'inversify';
import * as express from 'express';
import * as passport from 'passport';
import { BasicStrategy } from 'passport-http';

import { PaymentProtocol } from '@gitpod/gitpod-protocol/lib/payment-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

import { Config } from '../config';
import { CompositeEventHandler } from './chargebee-event-handler';
import * as bodyParser from 'body-parser';

@injectable()
export class EndpointController {
  @inject(Config) protected readonly config: Config;
  @inject(CompositeEventHandler) protected readonly eventHandler: CompositeEventHandler;

  get apiRouter(): express.Router {
    passport.use(
      new BasicStrategy((username, password, cb) => {
        if (username === this.config.chargebeeWebhook.user && password === this.config.chargebeeWebhook.password) {
          return cb(null, username);
        } else {
          return cb(null, false);
        }
      }),
    );

    const router = express.Router();
    router.use(bodyParser.json());
    router.use(bodyParser.urlencoded({ extended: true }));
    router.post(
      PaymentProtocol.UPDATE_GITPOD_SUBSCRIPTION_PATH,
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        passport.authenticate('basic', { session: false }, (err: any, user: any, info: any) => {
          if (err) {
            log.error(`Login error on chargebee payment update route!`, err, req);
            return; // Drop request
          }
          if (!user) {
            log.error(`Unauthorized user on chargebee payment update route!`, req);
            return; // Drop request
          }
          next();
        })(req, res, next);
      },
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        this.handleUpdateGitpodSubscription(req, res);
      },
    );
    return router;
  }

  /**
   * @see https://www.chargebee.com/docs/events_and_webhooks.html
   * @param req
   * @param res
   */
  private async handleUpdateGitpodSubscription(req: express.Request, res: express.Response) {
    if (!req.body || !req.body.event_type) {
      log.error('Received malformed event request from chargebee!');
      return;
    }

    try {
      const handled = await this.eventHandler.handle(req.body);
      if (!handled) {
        const payload = { chargebeeEventType: req.body.event_type, action: 'ignored' };
        log.debug(`Faithfully ignoring chargebee event of type: ${req.body.event_type}`, payload);
      }
      res.status(200).send();
    } catch (err) {
      log.error('Error handling subscription update', err);
      res.status(500).send();
    }
  }
}
