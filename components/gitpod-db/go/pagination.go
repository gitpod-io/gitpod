// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"gorm.io/gorm"
)

type Pagination struct {
	Page     int
	PageSize int
}

func Paginate(pagination Pagination) func(*gorm.DB) *gorm.DB {
	return func(conn *gorm.DB) *gorm.DB {
		page := 1
		if pagination.Page > 0 {
			page = pagination.Page
		}

		pageSize := 25
		if pagination.PageSize >= 0 {
			pageSize = pagination.PageSize
		}

		offset := (page - 1) * pageSize
		return conn.Offset(offset).Limit(pageSize)
	}
}

type PaginatedResult[T any] struct {
	Results []T
	Total   int64
}
