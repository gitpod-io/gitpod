// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

// CreateBucketRequest is the argument for CreateBucket
type CreateBucketRequest struct {
	Owner, Workspace string
}

// CreateBucketResponse is the response for CreateBucket
type CreateBucketResponse struct{}
