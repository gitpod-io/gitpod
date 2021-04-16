/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Actor, GitActor } from '../github-model';

export interface AuthorLinkProps {
    authorUrl: string
    login: string
}
export function AuthorLink(props: AuthorLinkProps): JSX.Element {
    return <a className='github-author' target="_blank" href={props.authorUrl}>{props.login}</a>;
}

export interface ActorLinkProps {
    actor: Actor | null
}
export function ActorLink(props: ActorLinkProps): JSX.Element | null {
    return props.actor && <AuthorLink authorUrl={props.actor.url} login={props.actor.login} />;
}

export interface GitActorLinkProps {
    actor: GitActor | null
}
export function GitActorLink(props: GitActorLinkProps): JSX.Element | null {
    const actor = props.actor;
    if (!actor) {
        return null;
    }
    if (actor.user) {
        return <ActorLink actor={actor.user} />;
    }
    if (!actor.name) {
        return null;
    }
    return <AuthorLink authorUrl={actor.avatarUrl} login={actor.name} />;
}
