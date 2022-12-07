// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"testing"

	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/stretchr/testify/require"
)

func TestValidatePagination(t *testing.T) {

	t.Run("empty pagination defaults to page size 25, page 1", func(t *testing.T) {
		require.Equal(t, &v1.Pagination{
			PageSize: 25,
			Page:     1,
		}, validatePagination(nil))

		require.Equal(t, &v1.Pagination{
			PageSize: 25,
			Page:     1,
		}, validatePagination(&v1.Pagination{}))
	})

	t.Run("negative, or zero, page defaults to page 1", func(t *testing.T) {
		require.Equal(t, &v1.Pagination{
			PageSize: 25,
			Page:     1,
		}, validatePagination(&v1.Pagination{
			Page: 0,
		}))

		require.Equal(t, &v1.Pagination{
			PageSize: 25,
			Page:     1,
		}, validatePagination(&v1.Pagination{
			Page: -1,
		}))
	})

	t.Run("page size of 0, or below, defaults to 25", func(t *testing.T) {
		require.Equal(t, &v1.Pagination{
			PageSize: 25,
			Page:     1,
		}, validatePagination(&v1.Pagination{
			PageSize: 0,
		}))

		require.Equal(t, &v1.Pagination{
			PageSize: 25,
			Page:     1,
		}, validatePagination(&v1.Pagination{
			PageSize: -1,
		}))
	})

	t.Run("page size greater than 100 defaults to 25", func(t *testing.T) {
		require.Equal(t, &v1.Pagination{
			PageSize: 25,
			Page:     1,
		}, validatePagination(&v1.Pagination{
			PageSize: 101,
		}))
	})

	t.Run("valid page and page size is used", func(t *testing.T) {
		require.Equal(t, &v1.Pagination{
			PageSize: 77,
			Page:     9,
		}, validatePagination(&v1.Pagination{
			PageSize: 77,
			Page:     9,
		}))
	})
}

func TestPageFromResults(t *testing.T) {
	var results []int
	for i := 0; i < 26; i++ {
		results = append(results, i)
	}

	require.EqualValues(t, results[0:25], pageFromResults(results, &v1.Pagination{}), "defaults to first page and 25 records")
	require.EqualValues(t, results[0:5], pageFromResults(results, &v1.Pagination{
		PageSize: 5,
	}), "defaults to first page, 10 records")
	require.EqualValues(t, results[5:10], pageFromResults(results, &v1.Pagination{
		PageSize: 5,
		Page:     2,
	}), "second page, 5 records")
	require.EqualValues(t, results[10:15], pageFromResults(results, &v1.Pagination{
		PageSize: 5,
		Page:     3,
	}), "third page, 5 records")
	require.EqualValues(t, results[25:], pageFromResults(results, &v1.Pagination{
		PageSize: 5,
		Page:     6,
	}), "last page, 5 records")
	require.Len(t, pageFromResults(results, &v1.Pagination{
		PageSize: 5,
		Page:     7,
	}), 0, "out of bound page, 5 records")

}
