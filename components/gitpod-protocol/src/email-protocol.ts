/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { v4 as uuidv4 } from 'uuid';

export type EMailState = 'scheduledInternal' | 'scheduledSendgrid';

export interface EMailStatus {
  /** The time the email entry was inserted into the DB */
  scheduledInternalTime: string;
  /** The time the email state transitioned to "scheduledSendgrid" */
  scheduledSendgridTime?: string;
  /** In case of any errors during sending with Sendgrid it gets noted here */
  error?: string;
}
export namespace EMailStatus {
  export function getState(status: EMailStatus): EMailState {
    if (status.scheduledSendgridTime) {
      return 'scheduledSendgrid';
    }
    return 'scheduledInternal';
  }
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EMailParameters {
  /** undefined means default from template */
  subject?: string;
  /** The sender address */
  senderAddress: string | EmailAddress;
  /** The replyTo address */
  replyToAddress?: string | EmailAddress;
  /** The SendGrid template id */
  templateId: string;
  /** The parameters for the SendGrid template */
  templateParams: {};
}

export type EMail = {
  /** The unique id of this email (uuid/v4 for now) */
  uid: string;
  /** The id of the user this email was sent to */
  userId: string;
  /** The address this email was sent to */
  recipientAddress: string;
  /** Which campaign scheduled this email  */
  campaignId: string;
  /** The parameters this email was sent with (template id, template params, etc) */
  params: EMailParameters;
} & EMailStatus;

export namespace EMail {
  export const create = (ts: Omit<EMail, 'uid'>): EMail => {
    const withId = ts as EMail;
    withId.uid = uuidv4();
    return withId;
  };
}
