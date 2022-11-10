// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"errors"
)

type contextKey int

const (
	authContextKey contextKey = iota
)

type TokenType int

const (
	AccessTokenType TokenType = iota
	CookieTokenType
)

type Token struct {
	Type  TokenType
	Value string
}

func NewAccessToken(token string) Token {
	return Token{
		Type:  AccessTokenType,
		Value: token,
	}
}

func NewCookieToken(cookie string) Token {
	return Token{
		Type:  CookieTokenType,
		Value: cookie,
	}
}

func TokenToContext(ctx context.Context, token Token) context.Context {
	return context.WithValue(ctx, authContextKey, token)
}

func TokenFromContext(ctx context.Context) (Token, error) {
	if val, ok := ctx.Value(authContextKey).(Token); ok {
		return val, nil
	}

	return Token{}, errors.New("no token present on context")
}
