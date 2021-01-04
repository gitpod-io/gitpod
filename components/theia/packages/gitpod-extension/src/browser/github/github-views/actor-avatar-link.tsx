/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { AuthorLinkProps, ActorLinkProps, GitActorLinkProps } from './actor-link';

export interface AuthorAvatarProps extends AuthorLinkProps {
    size: 'small' | 'medium'
    avatarUrl: string
}
export function AuthorAvatar(props: AuthorAvatarProps): JSX.Element {
    return <img className={"github-author-avatar " + props.size} src={props.avatarUrl} title={props.login} />;
}

export interface AuthorAvatarLinkProps extends AuthorAvatarProps {
    authorUrl: string
}
export function AuthorAvatarLink(props: AuthorAvatarLinkProps): JSX.Element {
    return <a className="github-author-avatar-link" target="_blank" href={props.authorUrl}>
        {AuthorAvatar(props)}
    </a>;
}

export interface ActorAvatarLinkProps extends ActorLinkProps {
    size: 'small' | 'medium'
}
export function ActorAvatarLink(props: ActorAvatarLinkProps): JSX.Element | null {
    return props.actor && <AuthorAvatarLink
        size={props.size}
        authorUrl={props.actor.url}
        avatarUrl={props.actor.avatarUrl}
        login={props.actor.login}
    />;
}

export interface GitActorAvatarLinkProps extends GitActorLinkProps {
    size: 'small' | 'medium'
}
export function GitActorAvatarLink(props: GitActorAvatarLinkProps): JSX.Element | null {
    const actor = props.actor;
    if (!actor) {
        return null;
    }
    if (actor.user) {
        return <ActorAvatarLink
            size={props.size}
            actor={actor.user}
        />;
    }
    if (!actor.name) {
        return null;
    }
    return <AuthorAvatarLink
        size={props.size}
        authorUrl={actor.avatarUrl}
        avatarUrl={actor.avatarUrl}
        login={actor.name}
    />;
}
