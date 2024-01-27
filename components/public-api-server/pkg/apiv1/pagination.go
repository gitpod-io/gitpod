// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

func validatePagination(p *v1.Pagination) *v1.Pagination {
	pagination := &v1.Pagination{
		PageSize: 25,
		Page:     1,
	}

	if p == nil {
		return pagination
	}

	if p.Page > 0 {
		pagination.Page = p.Page
	}
	if p.PageSize > 0 && p.PageSize <= 100 {
		pagination.PageSize = p.PageSize
	}

	return pagination
}

func paginationToDB(p *v1.Pagination) db.Pagination {
	validated := validatePagination(p)
	return db.Pagination{
		Page:     int(validated.GetPage()),
		PageSize: int(validated.GetPageSize()),
	}
}

func pageFromResults[T any](results []T, p *v1.Pagination) []T {
	pagination := validatePagination(p)

	size := len(results)

	start := int((pagination.Page - 1) * pagination.PageSize)
	end := int(pagination.Page * pagination.PageSize)

	if start > size {
		return nil
	}

	if end > size {
		end = size
	}

	return results[start:end]
}
