// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package executor

import (
	"context"
	"fmt"
	"strings"
)

func SplitObj(obj string) (tpe, key string, err error) {
	segs := strings.Split(obj, ":")
	if len(segs) != 2 {
		return "", "", fmt.Errorf("invalid object: %v", obj)
	}
	return segs[0], segs[1], nil
}

type DB interface {
	RowExists(ctx context.Context, table string, cv ...string) (exists bool, err error)
}

type MapDB map[string]MapDBTable
type MapDBCol string
type MapDBRow map[MapDBCol]string
type MapDBTable []MapDBRow

func (m MapDB) RowExists(ctx context.Context, table string, cv ...string) (exists bool, err error) {
	if len(cv)%2 != 0 {
		return false, fmt.Errorf("invalid call to RowExists: uneven column/value pairs")
	}

	t, ok := m[table]
	if !ok {
		return false, nil
	}
	for _, row := range t {
		for i := 0; i < len(cv)/2; i += 2 {
			col, expectedValue := cv[2*i+0], cv[2*i+1]
			v, ok := row[MapDBCol(col)]
			if !ok {
				continue
			}
			if v == expectedValue {
				return true, nil
			}
		}
	}
	return false, nil
}
