// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

type Order int

func (o Order) ToSQL() string {
	switch o {
	case AscendingOrder:
		return "ASC"
	default:
		return "DESC"
	}
}

const (
	DescendingOrder Order = iota
	AscendingOrder
)
