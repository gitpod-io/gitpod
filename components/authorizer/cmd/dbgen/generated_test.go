// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main_test

import (
	"context"
	executor "github.com/gitpod-io/gitpod/authorizer/pkg/executor"
)

func (sess *Session) checkUserOwner(ctx context.Context, actorKey, subjKey string) (bool, error) {
	// is self
	if ok, err := sess.DB.RowExists(ctx, "d_b_user", "id", actorKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkUserWriter(ctx context.Context, actorKey, subjKey string) (bool, error) {
	// is self
	if ok, err := sess.DB.RowExists(ctx, "d_b_user", "id", actorKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	if ok, err := sess.checkUserOwner(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkUserReader(ctx context.Context, actorKey, subjKey string) (bool, error) {
	// is self
	if ok, err := sess.DB.RowExists(ctx, "d_b_user", "id", actorKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	if ok, err := sess.checkUserWriter(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkWorkspaceOwner(ctx context.Context, actorKey, subjKey string) (bool, error) {
	// is ownerId from user
	if ok, err := sess.DB.RowExists(ctx, "d_b_workspace", "id", actorKey, "ownerId", subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkWorkspaceAccess(ctx context.Context, actorKey, subjKey string) (bool, error) {
	// is self
	if ok, err := sess.DB.RowExists(ctx, "d_b_workspace", "id", actorKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	if ok, err := sess.checkWorkspaceOwner(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkWorkspaceWriter(ctx context.Context, actorKey, subjKey string) (bool, error) {
	// is self
	if ok, err := sess.DB.RowExists(ctx, "d_b_workspace", "id", actorKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	if ok, err := sess.checkWorkspaceOwner(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkWorkspaceReader(ctx context.Context, actorKey, subjKey string) (bool, error) {
	// is self
	if ok, err := sess.DB.RowExists(ctx, "d_b_workspace", "id", actorKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	if ok, err := sess.checkWorkspaceAccess(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	if ok, err := sess.checkWorkspaceWriter(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkWorkspaceInstanceOwner(ctx context.Context, actorKey, subjKey string) (bool, error) {
	if ok, err := sess.checkWorkspaceOwner(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) checkWorkspaceInstanceAccess(ctx context.Context, actorKey, subjKey string) (bool, error) {
	if ok, err := sess.checkWorkspaceInstanceOwner(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	if ok, err := sess.checkWorkspaceAccess(ctx, actorKey, subjKey); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	return false, nil
}
func (sess *Session) Check(ctx context.Context, actor, rel, subject string) (bool, error) {
	actorType, actorKey, err := executor.SplitObj(actor)
	if err != nil {
		return false, err
	}
	_, subjKey, err := executor.SplitObj(subject)
	switch {
	case actorType == "user" && rel == "owner":
		return sess.checkUserOwner(ctx, actorKey, subjKey)
	case actorType == "user" && rel == "writer":
		return sess.checkUserWriter(ctx, actorKey, subjKey)
	case actorType == "user" && rel == "reader":
		return sess.checkUserReader(ctx, actorKey, subjKey)
	case actorType == "workspace" && rel == "owner":
		return sess.checkWorkspaceOwner(ctx, actorKey, subjKey)
	case actorType == "workspace" && rel == "access":
		return sess.checkWorkspaceAccess(ctx, actorKey, subjKey)
	case actorType == "workspace" && rel == "writer":
		return sess.checkWorkspaceWriter(ctx, actorKey, subjKey)
	case actorType == "workspace" && rel == "reader":
		return sess.checkWorkspaceReader(ctx, actorKey, subjKey)
	case actorType == "workspace_instance" && rel == "owner":
		return sess.checkWorkspaceInstanceOwner(ctx, actorKey, subjKey)
	case actorType == "workspace_instance" && rel == "access":
		return sess.checkWorkspaceInstanceAccess(ctx, actorKey, subjKey)
	}
	return false, nil
}

type Session struct {
	DB executor.DB
}
