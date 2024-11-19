// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by connect-kotlin. DO NOT EDIT.
//
// Source: gitpod/experimental/v1/scm.proto
//
package io.gitpod.publicapi.experimental.v1

import com.connectrpc.Headers
import com.connectrpc.ResponseMessage

public interface SCMServiceClientInterface {
  /**
   *  GetSuggestedRepoURLs returns a list of suggested repositories to open for
   *  the user.
   */
  public suspend fun getSuggestedRepoURLs(request: Scm.GetSuggestedRepoURLsRequest, headers: Headers
      = emptyMap()): ResponseMessage<Scm.GetSuggestedRepoURLsResponse>
}
