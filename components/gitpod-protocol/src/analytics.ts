/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const IAnalyticsWriter = Symbol('IAnalyticsWriter');

type Identity =
    | { userId: string | number; anonymousId?: string | number }
    | { userId?: string | number; anonymousId: string | number };

interface Message {
    messageId?: string;
}

export type IdentifyMessage = Message &
    Identity & {
        traits?: any;
        timestamp?: Date;
        context?: any;
    };

export type TrackMessage = Message &
    Identity & {
        event: string;
        properties?: any;
        timestamp?: Date;
        context?: any;
    };

export type PageMessage = Message &
    Identity & {
        properties?: any;
        timestamp?: Date;
        context?: any;
    };

export type RemoteTrackMessage = Omit<TrackMessage, 'timestamp' | 'userId'>;
export type RemotePageMessage = Omit<PageMessage, 'timestamp' | 'userId'> & {
    includePII?: boolean;
};

export type RemoteIdentifyMessage = Omit<IdentifyMessage, 'timestamp' | 'userId'>;

export interface IAnalyticsWriter {
    identify(msg: IdentifyMessage): void;

    track(msg: TrackMessage): void;

    page(msg: PageMessage): void;
}
