/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';

@injectable()
export class MessagebusConfiguration {
  public readonly amqpHost = process.env.MESSAGEBUS_HOST || 'messagebus';
  public readonly amqpPort = process.env.MESSAGEBUS_SERVICE_PORT_AMQP || '5672';
  public readonly amqpUsername = process.env.MESSAGEBUS_USERNAME || 'guest';
  public readonly amqpPassword = process.env.MESSAGEBUS_PASSWORD || 'guest';
  public readonly amqpCa = process.env.MESSAGEBUS_CA || undefined;
  public readonly amqpCert = process.env.MESSAGEBUS_CERT || undefined;
  public readonly amqpKey = process.env.MESSAGEBUS_KEY || undefined;
}
