// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by connect-kotlin. DO NOT EDIT.
//
// Source: gitpod/experimental/v1/projects.proto
//
package io.gitpod.publicapi.experimental.v1

import com.connectrpc.Headers
import com.connectrpc.MethodSpec
import com.connectrpc.ProtocolClientInterface
import com.connectrpc.ResponseMessage
import com.connectrpc.StreamType

public class ProjectsServiceClient(
  private val client: ProtocolClientInterface,
) : ProjectsServiceClientInterface {
  /**
   *  Creates a new project.
   */
  override suspend fun createProject(request: Projects.CreateProjectRequest, headers: Headers):
      ResponseMessage<Projects.CreateProjectResponse> = client.unary(
    request,
    headers,
    MethodSpec(
    "gitpod.experimental.v1.ProjectsService/CreateProject",
      io.gitpod.publicapi.experimental.v1.Projects.CreateProjectRequest::class,
      io.gitpod.publicapi.experimental.v1.Projects.CreateProjectResponse::class,
      StreamType.UNARY,
    ),
  )


  /**
   *  Retrieves a project.
   */
  override suspend fun getProject(request: Projects.GetProjectRequest, headers: Headers):
      ResponseMessage<Projects.GetProjectResponse> = client.unary(
    request,
    headers,
    MethodSpec(
    "gitpod.experimental.v1.ProjectsService/GetProject",
      io.gitpod.publicapi.experimental.v1.Projects.GetProjectRequest::class,
      io.gitpod.publicapi.experimental.v1.Projects.GetProjectResponse::class,
      StreamType.UNARY,
    ),
  )


  /**
   *  Lists projects.
   */
  override suspend fun listProjects(request: Projects.ListProjectsRequest, headers: Headers):
      ResponseMessage<Projects.ListProjectsResponse> = client.unary(
    request,
    headers,
    MethodSpec(
    "gitpod.experimental.v1.ProjectsService/ListProjects",
      io.gitpod.publicapi.experimental.v1.Projects.ListProjectsRequest::class,
      io.gitpod.publicapi.experimental.v1.Projects.ListProjectsResponse::class,
      StreamType.UNARY,
    ),
  )


  /**
   *  Deletes a project.
   */
  override suspend fun deleteProject(request: Projects.DeleteProjectRequest, headers: Headers):
      ResponseMessage<Projects.DeleteProjectResponse> = client.unary(
    request,
    headers,
    MethodSpec(
    "gitpod.experimental.v1.ProjectsService/DeleteProject",
      io.gitpod.publicapi.experimental.v1.Projects.DeleteProjectRequest::class,
      io.gitpod.publicapi.experimental.v1.Projects.DeleteProjectResponse::class,
      StreamType.UNARY,
    ),
  )

}
