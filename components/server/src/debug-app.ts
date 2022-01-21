/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as http from 'http';
import * as express from 'express';
import { injectable, postConstruct } from 'inversify';
import { log, LogrusLogLevel } from '@gitpod/gitpod-protocol/lib/util/logging';

export interface SetLogLevelRequest {
  level: LogrusLogLevel;
}
export namespace SetLogLevelRequest {
  export function is(o: any): o is SetLogLevelRequest {
    return typeof o === 'object' && 'level' in o;
  }
}

@injectable()
export class DebugApp {
  protected _app: express.Application;
  protected httpServer: http.Server | undefined = undefined;

  @postConstruct()
  public ctor() {
    this._app = this.create();
  }

  create(): express.Application {
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.post('/debug/logging', (req, res) => {
      try {
        const levelRequest = req.body;
        if (!SetLogLevelRequest.is(levelRequest)) {
          res.status(400).end('not a SetLogLevelRequest');
          return;
        }

        const newLogLevel = levelRequest.level;
        log.setLogLevel(newLogLevel);
        log.info('set log level', { newLogLevel });
        res.status(200).end(JSON.stringify(levelRequest));
      } catch (err) {
        res.status(500).end(err);
      }
    });
    return app;
  }

  public start(port: number) {
    this.httpServer = this._app.listen(port, 'localhost', () => {
      log.info(`debug server listening on port: ${port}`);
    });
  }

  public async stop() {
    const server = this.httpServer;
    if (!server) {
      return;
    }
    return new Promise<void>((resolve) =>
      server.close((err: any) => {
        if (err) {
          log.warn(`error while closing http server`, { err });
        }
        this.httpServer = undefined;
        resolve();
      }),
    );
  }

  public get app(): express.Application {
    return this._app;
  }
}
