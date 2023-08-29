/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Struct } from "../../../google/protobuf/struct.pb";
import {
  Cursor,
  ObjectReference,
  PartialCaveatInfo,
  PermissionRelationshipTree,
  Relationship,
  RelationshipUpdate,
  SubjectReference,
  ZedToken,
} from "./core.pb";

export const protobufPackage = "authzed.api.v1";

/** LookupPermissionship represents whether a Lookup response was partially evaluated or not */
export enum LookupPermissionship {
  LOOKUP_PERMISSIONSHIP_UNSPECIFIED = "LOOKUP_PERMISSIONSHIP_UNSPECIFIED",
  LOOKUP_PERMISSIONSHIP_HAS_PERMISSION = "LOOKUP_PERMISSIONSHIP_HAS_PERMISSION",
  LOOKUP_PERMISSIONSHIP_CONDITIONAL_PERMISSION = "LOOKUP_PERMISSIONSHIP_CONDITIONAL_PERMISSION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function lookupPermissionshipFromJSON(object: any): LookupPermissionship {
  switch (object) {
    case 0:
    case "LOOKUP_PERMISSIONSHIP_UNSPECIFIED":
      return LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED;
    case 1:
    case "LOOKUP_PERMISSIONSHIP_HAS_PERMISSION":
      return LookupPermissionship.LOOKUP_PERMISSIONSHIP_HAS_PERMISSION;
    case 2:
    case "LOOKUP_PERMISSIONSHIP_CONDITIONAL_PERMISSION":
      return LookupPermissionship.LOOKUP_PERMISSIONSHIP_CONDITIONAL_PERMISSION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return LookupPermissionship.UNRECOGNIZED;
  }
}

export function lookupPermissionshipToJSON(object: LookupPermissionship): string {
  switch (object) {
    case LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED:
      return "LOOKUP_PERMISSIONSHIP_UNSPECIFIED";
    case LookupPermissionship.LOOKUP_PERMISSIONSHIP_HAS_PERMISSION:
      return "LOOKUP_PERMISSIONSHIP_HAS_PERMISSION";
    case LookupPermissionship.LOOKUP_PERMISSIONSHIP_CONDITIONAL_PERMISSION:
      return "LOOKUP_PERMISSIONSHIP_CONDITIONAL_PERMISSION";
    case LookupPermissionship.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function lookupPermissionshipToNumber(object: LookupPermissionship): number {
  switch (object) {
    case LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED:
      return 0;
    case LookupPermissionship.LOOKUP_PERMISSIONSHIP_HAS_PERMISSION:
      return 1;
    case LookupPermissionship.LOOKUP_PERMISSIONSHIP_CONDITIONAL_PERMISSION:
      return 2;
    case LookupPermissionship.UNRECOGNIZED:
    default:
      return -1;
  }
}

/**
 * Consistency will define how a request is handled by the backend.
 * By defining a consistency requirement, and a token at which those
 * requirements should be applied, where applicable.
 */
export interface Consistency {
  /**
   * minimize_latency indicates that the latency for the call should be
   * minimized by having the system select the fastest snapshot available.
   */
  minimizeLatency:
    | boolean
    | undefined;
  /**
   * at_least_as_fresh indicates that all data used in the API call must be
   * *at least as fresh* as that found in the ZedToken; more recent data might
   * be used if available or faster.
   */
  atLeastAsFresh:
    | ZedToken
    | undefined;
  /**
   * at_exact_snapshot indicates that all data used in the API call must be
   * *at the given* snapshot in time; if the snapshot is no longer available,
   * an error will be returned to the caller.
   */
  atExactSnapshot:
    | ZedToken
    | undefined;
  /**
   * fully_consistent indicates that all data used in the API call *must* be
   * at the most recent snapshot found.
   *
   * NOTE: using this method can be *quite slow*, so unless there is a need to
   * do so, it is recommended to use `at_least_as_fresh` with a stored
   * ZedToken.
   */
  fullyConsistent: boolean | undefined;
}

/**
 * RelationshipFilter is a collection of filters which when applied to a
 * relationship will return relationships that have exactly matching fields.
 *
 * resource_type is required. All other fields are optional and if left
 * unspecified will not filter relationships.
 */
export interface RelationshipFilter {
  resourceType: string;
  optionalResourceId: string;
  optionalRelation: string;
  optionalSubjectFilter: SubjectFilter | undefined;
}

/**
 * SubjectFilter specifies a filter on the subject of a relationship.
 *
 * subject_type is required and all other fields are optional, and will not
 * impose any additional requirements if left unspecified.
 */
export interface SubjectFilter {
  subjectType: string;
  optionalSubjectId: string;
  optionalRelation: SubjectFilter_RelationFilter | undefined;
}

export interface SubjectFilter_RelationFilter {
  relation: string;
}

/**
 * ReadRelationshipsRequest specifies one or more filters used to read matching
 * relationships within the system.
 */
export interface ReadRelationshipsRequest {
  consistency:
    | Consistency
    | undefined;
  /**
   * relationship_filter defines the filter to be applied to the relationships
   * to be returned.
   */
  relationshipFilter:
    | RelationshipFilter
    | undefined;
  /**
   * optional_limit, if non-zero, specifies the limit on the number of relationships to return
   * before the stream is closed on the server side. By default, the stream will continue
   * resolving relationships until exhausted or the stream is closed due to the client or a
   * network issue.
   */
  optionalLimit: number;
  /**
   * optional_cursor, if specified, indicates the cursor after which results should resume being returned.
   * The cursor can be found on the ReadRelationshipsResponse object.
   */
  optionalCursor: Cursor | undefined;
}

/**
 * ReadRelationshipsResponse contains a Relationship found that matches the
 * specified relationship filter(s). A instance of this response message will
 * be streamed to the client for each relationship found.
 */
export interface ReadRelationshipsResponse {
  /** read_at is the ZedToken at which the relationship was found. */
  readAt:
    | ZedToken
    | undefined;
  /** relationship is the found relationship. */
  relationship:
    | Relationship
    | undefined;
  /**
   * after_result_cursor holds a cursor that can be used to resume the ReadRelationships stream after this
   * result.
   */
  afterResultCursor: Cursor | undefined;
}

/**
 * Precondition specifies how and the existence or absence of certain
 * relationships as expressed through the accompanying filter should affect
 * whether or not the operation proceeds.
 *
 * MUST_NOT_MATCH will fail the parent request if any relationships match the
 * relationships filter.
 * MUST_MATCH will fail the parent request if there are no
 * relationships that match the filter.
 */
export interface Precondition {
  operation: Precondition_Operation;
  filter: RelationshipFilter | undefined;
}

export enum Precondition_Operation {
  OPERATION_UNSPECIFIED = "OPERATION_UNSPECIFIED",
  OPERATION_MUST_NOT_MATCH = "OPERATION_MUST_NOT_MATCH",
  OPERATION_MUST_MATCH = "OPERATION_MUST_MATCH",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function precondition_OperationFromJSON(object: any): Precondition_Operation {
  switch (object) {
    case 0:
    case "OPERATION_UNSPECIFIED":
      return Precondition_Operation.OPERATION_UNSPECIFIED;
    case 1:
    case "OPERATION_MUST_NOT_MATCH":
      return Precondition_Operation.OPERATION_MUST_NOT_MATCH;
    case 2:
    case "OPERATION_MUST_MATCH":
      return Precondition_Operation.OPERATION_MUST_MATCH;
    case -1:
    case "UNRECOGNIZED":
    default:
      return Precondition_Operation.UNRECOGNIZED;
  }
}

export function precondition_OperationToJSON(object: Precondition_Operation): string {
  switch (object) {
    case Precondition_Operation.OPERATION_UNSPECIFIED:
      return "OPERATION_UNSPECIFIED";
    case Precondition_Operation.OPERATION_MUST_NOT_MATCH:
      return "OPERATION_MUST_NOT_MATCH";
    case Precondition_Operation.OPERATION_MUST_MATCH:
      return "OPERATION_MUST_MATCH";
    case Precondition_Operation.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function precondition_OperationToNumber(object: Precondition_Operation): number {
  switch (object) {
    case Precondition_Operation.OPERATION_UNSPECIFIED:
      return 0;
    case Precondition_Operation.OPERATION_MUST_NOT_MATCH:
      return 1;
    case Precondition_Operation.OPERATION_MUST_MATCH:
      return 2;
    case Precondition_Operation.UNRECOGNIZED:
    default:
      return -1;
  }
}

/**
 * WriteRelationshipsRequest contains a list of Relationship mutations that
 * should be applied to the service. If the optional_preconditions parameter
 * is included, all of the specified preconditions must also be satisfied before
 * the write will be committed.
 */
export interface WriteRelationshipsRequest {
  updates: RelationshipUpdate[];
  /** To be bounded by configuration */
  optionalPreconditions: Precondition[];
}

export interface WriteRelationshipsResponse {
  writtenAt: ZedToken | undefined;
}

/**
 * DeleteRelationshipsRequest specifies which Relationships should be deleted,
 * requesting the delete of *ALL* relationships that match the specified
 * filters. If the optional_preconditions parameter is included, all of the
 * specified preconditions must also be satisfied before the delete will be
 * executed.
 */
export interface DeleteRelationshipsRequest {
  relationshipFilter:
    | RelationshipFilter
    | undefined;
  /** To be bounded by configuration */
  optionalPreconditions: Precondition[];
  /**
   * optional_limit, if non-zero, specifies the limit on the number of relationships to be deleted.
   * If there are more matching relationships found to be deleted than the limit specified here,
   * the deletion call will fail with an error to prevent partial deletion. If partial deletion
   * is needed, specify below that partial deletion is allowed. Partial deletions can be used
   * in a loop to delete large amounts of relationships in a *non-transactional* manner.
   */
  optionalLimit: number;
  /**
   * optional_allow_partial_deletions, if true and a limit is specified, will delete matching found
   * relationships up to the count specified in optional_limit, and no more.
   */
  optionalAllowPartialDeletions: boolean;
}

export interface DeleteRelationshipsResponse {
  /** deleted_at is the revision at which the relationships were deleted. */
  deletedAt:
    | ZedToken
    | undefined;
  /** deletion_progress is an enumeration of the possible outcomes that occurred when attempting to delete the specified relationships. */
  deletionProgress: DeleteRelationshipsResponse_DeletionProgress;
}

export enum DeleteRelationshipsResponse_DeletionProgress {
  DELETION_PROGRESS_UNSPECIFIED = "DELETION_PROGRESS_UNSPECIFIED",
  /**
   * DELETION_PROGRESS_COMPLETE - DELETION_PROGRESS_COMPLETE indicates that all remaining relationships matching the filter
   * were deleted. Will be returned even if no relationships were deleted.
   */
  DELETION_PROGRESS_COMPLETE = "DELETION_PROGRESS_COMPLETE",
  /**
   * DELETION_PROGRESS_PARTIAL - DELETION_PROGRESS_PARTIAL indicates that a subset of the relationships matching the filter
   * were deleted. Only returned if optional_allow_partial_deletions was true, an optional_limit was
   * specified, and there existed more relationships matching the filter than optional_limit would allow.
   * Once all remaining relationships have been deleted, DELETION_PROGRESS_COMPLETE will be returned.
   */
  DELETION_PROGRESS_PARTIAL = "DELETION_PROGRESS_PARTIAL",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function deleteRelationshipsResponse_DeletionProgressFromJSON(
  object: any,
): DeleteRelationshipsResponse_DeletionProgress {
  switch (object) {
    case 0:
    case "DELETION_PROGRESS_UNSPECIFIED":
      return DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_UNSPECIFIED;
    case 1:
    case "DELETION_PROGRESS_COMPLETE":
      return DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_COMPLETE;
    case 2:
    case "DELETION_PROGRESS_PARTIAL":
      return DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_PARTIAL;
    case -1:
    case "UNRECOGNIZED":
    default:
      return DeleteRelationshipsResponse_DeletionProgress.UNRECOGNIZED;
  }
}

export function deleteRelationshipsResponse_DeletionProgressToJSON(
  object: DeleteRelationshipsResponse_DeletionProgress,
): string {
  switch (object) {
    case DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_UNSPECIFIED:
      return "DELETION_PROGRESS_UNSPECIFIED";
    case DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_COMPLETE:
      return "DELETION_PROGRESS_COMPLETE";
    case DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_PARTIAL:
      return "DELETION_PROGRESS_PARTIAL";
    case DeleteRelationshipsResponse_DeletionProgress.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function deleteRelationshipsResponse_DeletionProgressToNumber(
  object: DeleteRelationshipsResponse_DeletionProgress,
): number {
  switch (object) {
    case DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_UNSPECIFIED:
      return 0;
    case DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_COMPLETE:
      return 1;
    case DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_PARTIAL:
      return 2;
    case DeleteRelationshipsResponse_DeletionProgress.UNRECOGNIZED:
    default:
      return -1;
  }
}

/**
 * CheckPermissionRequest issues a check on whether a subject has a permission
 * or is a member of a relation, on a specific resource.
 */
export interface CheckPermissionRequest {
  consistency:
    | Consistency
    | undefined;
  /** resource is the resource on which to check the permission or relation. */
  resource:
    | ObjectReference
    | undefined;
  /**
   * permission is the name of the permission (or relation) on which to execute
   * the check.
   */
  permission: string;
  /** subject is the subject that will be checked for the permission or relation. */
  subject:
    | SubjectReference
    | undefined;
  /** context consists of named values that are injected into the caveat evaluation context */
  context: { [key: string]: any } | undefined;
}

export interface CheckPermissionResponse {
  checkedAt:
    | ZedToken
    | undefined;
  /**
   * Permissionship communicates whether or not the subject has the requested
   * permission or has a relationship with the given resource, over the given
   * relation.
   *
   * This value will be authzed.api.v1.PERMISSIONSHIP_HAS_PERMISSION if the
   * requested subject is a member of the computed permission set or there
   * exists a relationship with the requested relation from the given resource
   * to the given subject.
   */
  permissionship: CheckPermissionResponse_Permissionship;
  /** partial_caveat_info holds information of a partially-evaluated caveated response */
  partialCaveatInfo: PartialCaveatInfo | undefined;
}

export enum CheckPermissionResponse_Permissionship {
  PERMISSIONSHIP_UNSPECIFIED = "PERMISSIONSHIP_UNSPECIFIED",
  PERMISSIONSHIP_NO_PERMISSION = "PERMISSIONSHIP_NO_PERMISSION",
  PERMISSIONSHIP_HAS_PERMISSION = "PERMISSIONSHIP_HAS_PERMISSION",
  PERMISSIONSHIP_CONDITIONAL_PERMISSION = "PERMISSIONSHIP_CONDITIONAL_PERMISSION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function checkPermissionResponse_PermissionshipFromJSON(object: any): CheckPermissionResponse_Permissionship {
  switch (object) {
    case 0:
    case "PERMISSIONSHIP_UNSPECIFIED":
      return CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED;
    case 1:
    case "PERMISSIONSHIP_NO_PERMISSION":
      return CheckPermissionResponse_Permissionship.PERMISSIONSHIP_NO_PERMISSION;
    case 2:
    case "PERMISSIONSHIP_HAS_PERMISSION":
      return CheckPermissionResponse_Permissionship.PERMISSIONSHIP_HAS_PERMISSION;
    case 3:
    case "PERMISSIONSHIP_CONDITIONAL_PERMISSION":
      return CheckPermissionResponse_Permissionship.PERMISSIONSHIP_CONDITIONAL_PERMISSION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return CheckPermissionResponse_Permissionship.UNRECOGNIZED;
  }
}

export function checkPermissionResponse_PermissionshipToJSON(object: CheckPermissionResponse_Permissionship): string {
  switch (object) {
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED:
      return "PERMISSIONSHIP_UNSPECIFIED";
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_NO_PERMISSION:
      return "PERMISSIONSHIP_NO_PERMISSION";
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_HAS_PERMISSION:
      return "PERMISSIONSHIP_HAS_PERMISSION";
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_CONDITIONAL_PERMISSION:
      return "PERMISSIONSHIP_CONDITIONAL_PERMISSION";
    case CheckPermissionResponse_Permissionship.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function checkPermissionResponse_PermissionshipToNumber(object: CheckPermissionResponse_Permissionship): number {
  switch (object) {
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED:
      return 0;
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_NO_PERMISSION:
      return 1;
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_HAS_PERMISSION:
      return 2;
    case CheckPermissionResponse_Permissionship.PERMISSIONSHIP_CONDITIONAL_PERMISSION:
      return 3;
    case CheckPermissionResponse_Permissionship.UNRECOGNIZED:
    default:
      return -1;
  }
}

/**
 * ExpandPermissionTreeRequest returns a tree representing the expansion of all
 * relationships found accessible from a permission or relation on a particular
 * resource.
 *
 * ExpandPermissionTreeRequest is typically used to determine the full set of
 * subjects with a permission, along with the relationships that grant said
 * access.
 */
export interface ExpandPermissionTreeRequest {
  consistency:
    | Consistency
    | undefined;
  /** resource is the resource over which to run the expansion. */
  resource:
    | ObjectReference
    | undefined;
  /**
   * permission is the name of the permission or relation over which to run the
   * expansion for the resource.
   */
  permission: string;
}

export interface ExpandPermissionTreeResponse {
  expandedAt:
    | ZedToken
    | undefined;
  /**
   * tree_root is a tree structure whose leaf nodes are subjects, and
   * intermediate nodes represent the various operations (union, intersection,
   * exclusion) to reach those subjects.
   */
  treeRoot: PermissionRelationshipTree | undefined;
}

/**
 * LookupResourcesRequest performs a lookup of all resources of a particular
 * kind on which the subject has the specified permission or the relation in
 * which the subject exists, streaming back the IDs of those resources.
 */
export interface LookupResourcesRequest {
  consistency:
    | Consistency
    | undefined;
  /**
   * resource_object_type is the type of resource object for which the IDs will
   * be returned.
   */
  resourceObjectType: string;
  /**
   * permission is the name of the permission or relation for which the subject
   * must Check.
   */
  permission: string;
  /** subject is the subject with access to the resources. */
  subject:
    | SubjectReference
    | undefined;
  /** context consists of named values that are injected into the caveat evaluation context */
  context:
    | { [key: string]: any }
    | undefined;
  /**
   * optional_limit, if non-zero, specifies the limit on the number of resources to return
   * before the stream is closed on the server side. By default, the stream will continue
   * resolving resources until exhausted or the stream is closed due to the client or a
   * network issue.
   */
  optionalLimit: number;
  /**
   * optional_cursor, if specified, indicates the cursor after which results should resume being returned.
   * The cursor can be found on the LookupResourcesResponse object.
   */
  optionalCursor: Cursor | undefined;
}

/**
 * LookupResourcesResponse contains a single matching resource object ID for the
 * requested object type, permission, and subject.
 */
export interface LookupResourcesResponse {
  /** looked_up_at is the ZedToken at which the resource was found. */
  lookedUpAt:
    | ZedToken
    | undefined;
  /** resource_object_id is the object ID of the found resource. */
  resourceObjectId: string;
  /** permissionship indicates whether the response was partially evaluated or not */
  permissionship: LookupPermissionship;
  /** partial_caveat_info holds information of a partially-evaluated caveated response */
  partialCaveatInfo:
    | PartialCaveatInfo
    | undefined;
  /**
   * after_result_cursor holds a cursor that can be used to resume the LookupResources stream after this
   * result.
   */
  afterResultCursor: Cursor | undefined;
}

/**
 * LookupSubjectsRequest performs a lookup of all subjects of a particular
 * kind for which the subject has the specified permission or the relation in
 * which the subject exists, streaming back the IDs of those subjects.
 */
export interface LookupSubjectsRequest {
  consistency:
    | Consistency
    | undefined;
  /**
   * resource is the resource for which all matching subjects for the permission
   * or relation will be returned.
   */
  resource:
    | ObjectReference
    | undefined;
  /**
   * permission is the name of the permission (or relation) for which to find
   * the subjects.
   */
  permission: string;
  /**
   * subject_object_type is the type of subject object for which the IDs will
   * be returned.
   */
  subjectObjectType: string;
  /** optional_subject_relation is the optional relation for the subject. */
  optionalSubjectRelation: string;
  /** context consists of named values that are injected into the caveat evaluation context */
  context:
    | { [key: string]: any }
    | undefined;
  /**
   * optional_concrete_limit, if non-zero, specifies the limit on the number of
   * *concrete* (non-wildcard) subjects to return before the stream is closed on the
   * server side. With the default value of zero, the stream will continue resolving
   * concrete subjects until exhausted or the stream is closed due to the client or
   * a network issue.
   *
   * NOTE: Wildcard subjects ("*") have special treatment when cursors and limits are used. Because
   * wildcards can apply to *any* concrete subjects, if a wildcard subject is found within the dataset,
   * a wildcard subject can be returned for *all* LookupSubjects calls, regardless of the cursor or
   * limit.
   *
   * For example, if wildcards are requested, a wildcard subject exists, there is a specified limit
   * of 10 concrete subjects, and at least 10 concrete subjects exist, the API will return 11 subjects
   * in total: the 10 concrete + the wildcard
   *
   * Furthermore, if a wildcard has a set of exclusions generated by the dataset,
   * the exclusions *will respect the cursor* and only a *partial* set of exclusions will be returned
   * for each invocation of the API.
   *
   * ***IT IS UP TO THE CALLER IN THIS CASE TO COMBINE THE EXCLUSIONS IF DESIRED***
   */
  optionalConcreteLimit: number;
  /**
   * optional_cursor, if specified, indicates the cursor after which results should resume being returned.
   * The cursor can be found on the LookupSubjectsResponse object.
   *
   * NOTE: See above for notes about how cursors interact with wildcard subjects.
   */
  optionalCursor:
    | Cursor
    | undefined;
  /**
   * wildcard_option specifies whether wildcards should be returned by LookupSubjects.
   * For backwards compatibility, defaults to WILDCARD_OPTION_INCLUDE_WILDCARDS if unspecified.
   */
  wildcardOption: LookupSubjectsRequest_WildcardOption;
}

export enum LookupSubjectsRequest_WildcardOption {
  WILDCARD_OPTION_UNSPECIFIED = "WILDCARD_OPTION_UNSPECIFIED",
  WILDCARD_OPTION_INCLUDE_WILDCARDS = "WILDCARD_OPTION_INCLUDE_WILDCARDS",
  WILDCARD_OPTION_EXCLUDE_WILDCARDS = "WILDCARD_OPTION_EXCLUDE_WILDCARDS",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function lookupSubjectsRequest_WildcardOptionFromJSON(object: any): LookupSubjectsRequest_WildcardOption {
  switch (object) {
    case 0:
    case "WILDCARD_OPTION_UNSPECIFIED":
      return LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_UNSPECIFIED;
    case 1:
    case "WILDCARD_OPTION_INCLUDE_WILDCARDS":
      return LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_INCLUDE_WILDCARDS;
    case 2:
    case "WILDCARD_OPTION_EXCLUDE_WILDCARDS":
      return LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_EXCLUDE_WILDCARDS;
    case -1:
    case "UNRECOGNIZED":
    default:
      return LookupSubjectsRequest_WildcardOption.UNRECOGNIZED;
  }
}

export function lookupSubjectsRequest_WildcardOptionToJSON(object: LookupSubjectsRequest_WildcardOption): string {
  switch (object) {
    case LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_UNSPECIFIED:
      return "WILDCARD_OPTION_UNSPECIFIED";
    case LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_INCLUDE_WILDCARDS:
      return "WILDCARD_OPTION_INCLUDE_WILDCARDS";
    case LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_EXCLUDE_WILDCARDS:
      return "WILDCARD_OPTION_EXCLUDE_WILDCARDS";
    case LookupSubjectsRequest_WildcardOption.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function lookupSubjectsRequest_WildcardOptionToNumber(object: LookupSubjectsRequest_WildcardOption): number {
  switch (object) {
    case LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_UNSPECIFIED:
      return 0;
    case LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_INCLUDE_WILDCARDS:
      return 1;
    case LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_EXCLUDE_WILDCARDS:
      return 2;
    case LookupSubjectsRequest_WildcardOption.UNRECOGNIZED:
    default:
      return -1;
  }
}

/**
 * LookupSubjectsResponse contains a single matching subject object ID for the
 * requested subject object type on the permission or relation.
 */
export interface LookupSubjectsResponse {
  lookedUpAt:
    | ZedToken
    | undefined;
  /**
   * subject_object_id is the Object ID of the subject found. May be a `*` if
   * a wildcard was found.
   * deprecated: use `subject`
   *
   * @deprecated
   */
  subjectObjectId: string;
  /**
   * excluded_subject_ids are the Object IDs of the subjects excluded. This list
   * will only contain object IDs if `subject_object_id` is a wildcard (`*`) and
   * will only be populated if exclusions exist from the wildcard.
   * deprecated: use `excluded_subjects`
   *
   * @deprecated
   */
  excludedSubjectIds: string[];
  /**
   * permissionship indicates whether the response was partially evaluated or not
   * deprecated: use `subject.permissionship`
   *
   * @deprecated
   */
  permissionship: LookupPermissionship;
  /**
   * partial_caveat_info holds information of a partially-evaluated caveated response
   * deprecated: use `subject.partial_caveat_info`
   *
   * @deprecated
   */
  partialCaveatInfo:
    | PartialCaveatInfo
    | undefined;
  /** subject is the subject found, along with its permissionship. */
  subject:
    | ResolvedSubject
    | undefined;
  /**
   * excluded_subjects are the subjects excluded. This list
   * will only contain subjects if `subject.subject_object_id` is a wildcard (`*`) and
   * will only be populated if exclusions exist from the wildcard.
   */
  excludedSubjects: ResolvedSubject[];
  /**
   * after_result_cursor holds a cursor that can be used to resume the LookupSubjects stream after this
   * result.
   */
  afterResultCursor: Cursor | undefined;
}

/** ResolvedSubject is a single subject resolved within LookupSubjects. */
export interface ResolvedSubject {
  /**
   * subject_object_id is the Object ID of the subject found. May be a `*` if
   * a wildcard was found.
   */
  subjectObjectId: string;
  /** permissionship indicates whether the response was partially evaluated or not */
  permissionship: LookupPermissionship;
  /** partial_caveat_info holds information of a partially-evaluated caveated response */
  partialCaveatInfo: PartialCaveatInfo | undefined;
}

function createBaseConsistency(): Consistency {
  return {
    minimizeLatency: undefined,
    atLeastAsFresh: undefined,
    atExactSnapshot: undefined,
    fullyConsistent: undefined,
  };
}

export const Consistency = {
  encode(message: Consistency, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.minimizeLatency !== undefined) {
      writer.uint32(8).bool(message.minimizeLatency);
    }
    if (message.atLeastAsFresh !== undefined) {
      ZedToken.encode(message.atLeastAsFresh, writer.uint32(18).fork()).ldelim();
    }
    if (message.atExactSnapshot !== undefined) {
      ZedToken.encode(message.atExactSnapshot, writer.uint32(26).fork()).ldelim();
    }
    if (message.fullyConsistent !== undefined) {
      writer.uint32(32).bool(message.fullyConsistent);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Consistency {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConsistency();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.minimizeLatency = reader.bool();
          break;
        case 2:
          message.atLeastAsFresh = ZedToken.decode(reader, reader.uint32());
          break;
        case 3:
          message.atExactSnapshot = ZedToken.decode(reader, reader.uint32());
          break;
        case 4:
          message.fullyConsistent = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Consistency {
    return {
      minimizeLatency: isSet(object.minimizeLatency) ? Boolean(object.minimizeLatency) : undefined,
      atLeastAsFresh: isSet(object.atLeastAsFresh) ? ZedToken.fromJSON(object.atLeastAsFresh) : undefined,
      atExactSnapshot: isSet(object.atExactSnapshot) ? ZedToken.fromJSON(object.atExactSnapshot) : undefined,
      fullyConsistent: isSet(object.fullyConsistent) ? Boolean(object.fullyConsistent) : undefined,
    };
  },

  toJSON(message: Consistency): unknown {
    const obj: any = {};
    message.minimizeLatency !== undefined && (obj.minimizeLatency = message.minimizeLatency);
    message.atLeastAsFresh !== undefined &&
      (obj.atLeastAsFresh = message.atLeastAsFresh ? ZedToken.toJSON(message.atLeastAsFresh) : undefined);
    message.atExactSnapshot !== undefined &&
      (obj.atExactSnapshot = message.atExactSnapshot ? ZedToken.toJSON(message.atExactSnapshot) : undefined);
    message.fullyConsistent !== undefined && (obj.fullyConsistent = message.fullyConsistent);
    return obj;
  },

  fromPartial(object: DeepPartial<Consistency>): Consistency {
    const message = createBaseConsistency();
    message.minimizeLatency = object.minimizeLatency ?? undefined;
    message.atLeastAsFresh = (object.atLeastAsFresh !== undefined && object.atLeastAsFresh !== null)
      ? ZedToken.fromPartial(object.atLeastAsFresh)
      : undefined;
    message.atExactSnapshot = (object.atExactSnapshot !== undefined && object.atExactSnapshot !== null)
      ? ZedToken.fromPartial(object.atExactSnapshot)
      : undefined;
    message.fullyConsistent = object.fullyConsistent ?? undefined;
    return message;
  },
};

function createBaseRelationshipFilter(): RelationshipFilter {
  return { resourceType: "", optionalResourceId: "", optionalRelation: "", optionalSubjectFilter: undefined };
}

export const RelationshipFilter = {
  encode(message: RelationshipFilter, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.resourceType !== "") {
      writer.uint32(10).string(message.resourceType);
    }
    if (message.optionalResourceId !== "") {
      writer.uint32(18).string(message.optionalResourceId);
    }
    if (message.optionalRelation !== "") {
      writer.uint32(26).string(message.optionalRelation);
    }
    if (message.optionalSubjectFilter !== undefined) {
      SubjectFilter.encode(message.optionalSubjectFilter, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RelationshipFilter {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRelationshipFilter();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.resourceType = reader.string();
          break;
        case 2:
          message.optionalResourceId = reader.string();
          break;
        case 3:
          message.optionalRelation = reader.string();
          break;
        case 4:
          message.optionalSubjectFilter = SubjectFilter.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RelationshipFilter {
    return {
      resourceType: isSet(object.resourceType) ? String(object.resourceType) : "",
      optionalResourceId: isSet(object.optionalResourceId) ? String(object.optionalResourceId) : "",
      optionalRelation: isSet(object.optionalRelation) ? String(object.optionalRelation) : "",
      optionalSubjectFilter: isSet(object.optionalSubjectFilter)
        ? SubjectFilter.fromJSON(object.optionalSubjectFilter)
        : undefined,
    };
  },

  toJSON(message: RelationshipFilter): unknown {
    const obj: any = {};
    message.resourceType !== undefined && (obj.resourceType = message.resourceType);
    message.optionalResourceId !== undefined && (obj.optionalResourceId = message.optionalResourceId);
    message.optionalRelation !== undefined && (obj.optionalRelation = message.optionalRelation);
    message.optionalSubjectFilter !== undefined && (obj.optionalSubjectFilter = message.optionalSubjectFilter
      ? SubjectFilter.toJSON(message.optionalSubjectFilter)
      : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<RelationshipFilter>): RelationshipFilter {
    const message = createBaseRelationshipFilter();
    message.resourceType = object.resourceType ?? "";
    message.optionalResourceId = object.optionalResourceId ?? "";
    message.optionalRelation = object.optionalRelation ?? "";
    message.optionalSubjectFilter =
      (object.optionalSubjectFilter !== undefined && object.optionalSubjectFilter !== null)
        ? SubjectFilter.fromPartial(object.optionalSubjectFilter)
        : undefined;
    return message;
  },
};

function createBaseSubjectFilter(): SubjectFilter {
  return { subjectType: "", optionalSubjectId: "", optionalRelation: undefined };
}

export const SubjectFilter = {
  encode(message: SubjectFilter, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.subjectType !== "") {
      writer.uint32(10).string(message.subjectType);
    }
    if (message.optionalSubjectId !== "") {
      writer.uint32(18).string(message.optionalSubjectId);
    }
    if (message.optionalRelation !== undefined) {
      SubjectFilter_RelationFilter.encode(message.optionalRelation, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubjectFilter {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubjectFilter();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.subjectType = reader.string();
          break;
        case 2:
          message.optionalSubjectId = reader.string();
          break;
        case 3:
          message.optionalRelation = SubjectFilter_RelationFilter.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SubjectFilter {
    return {
      subjectType: isSet(object.subjectType) ? String(object.subjectType) : "",
      optionalSubjectId: isSet(object.optionalSubjectId) ? String(object.optionalSubjectId) : "",
      optionalRelation: isSet(object.optionalRelation)
        ? SubjectFilter_RelationFilter.fromJSON(object.optionalRelation)
        : undefined,
    };
  },

  toJSON(message: SubjectFilter): unknown {
    const obj: any = {};
    message.subjectType !== undefined && (obj.subjectType = message.subjectType);
    message.optionalSubjectId !== undefined && (obj.optionalSubjectId = message.optionalSubjectId);
    message.optionalRelation !== undefined && (obj.optionalRelation = message.optionalRelation
      ? SubjectFilter_RelationFilter.toJSON(message.optionalRelation)
      : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<SubjectFilter>): SubjectFilter {
    const message = createBaseSubjectFilter();
    message.subjectType = object.subjectType ?? "";
    message.optionalSubjectId = object.optionalSubjectId ?? "";
    message.optionalRelation = (object.optionalRelation !== undefined && object.optionalRelation !== null)
      ? SubjectFilter_RelationFilter.fromPartial(object.optionalRelation)
      : undefined;
    return message;
  },
};

function createBaseSubjectFilter_RelationFilter(): SubjectFilter_RelationFilter {
  return { relation: "" };
}

export const SubjectFilter_RelationFilter = {
  encode(message: SubjectFilter_RelationFilter, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.relation !== "") {
      writer.uint32(10).string(message.relation);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubjectFilter_RelationFilter {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubjectFilter_RelationFilter();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.relation = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SubjectFilter_RelationFilter {
    return { relation: isSet(object.relation) ? String(object.relation) : "" };
  },

  toJSON(message: SubjectFilter_RelationFilter): unknown {
    const obj: any = {};
    message.relation !== undefined && (obj.relation = message.relation);
    return obj;
  },

  fromPartial(object: DeepPartial<SubjectFilter_RelationFilter>): SubjectFilter_RelationFilter {
    const message = createBaseSubjectFilter_RelationFilter();
    message.relation = object.relation ?? "";
    return message;
  },
};

function createBaseReadRelationshipsRequest(): ReadRelationshipsRequest {
  return { consistency: undefined, relationshipFilter: undefined, optionalLimit: 0, optionalCursor: undefined };
}

export const ReadRelationshipsRequest = {
  encode(message: ReadRelationshipsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    if (message.relationshipFilter !== undefined) {
      RelationshipFilter.encode(message.relationshipFilter, writer.uint32(18).fork()).ldelim();
    }
    if (message.optionalLimit !== 0) {
      writer.uint32(24).uint32(message.optionalLimit);
    }
    if (message.optionalCursor !== undefined) {
      Cursor.encode(message.optionalCursor, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReadRelationshipsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReadRelationshipsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.relationshipFilter = RelationshipFilter.decode(reader, reader.uint32());
          break;
        case 3:
          message.optionalLimit = reader.uint32();
          break;
        case 4:
          message.optionalCursor = Cursor.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ReadRelationshipsRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      relationshipFilter: isSet(object.relationshipFilter)
        ? RelationshipFilter.fromJSON(object.relationshipFilter)
        : undefined,
      optionalLimit: isSet(object.optionalLimit) ? Number(object.optionalLimit) : 0,
      optionalCursor: isSet(object.optionalCursor) ? Cursor.fromJSON(object.optionalCursor) : undefined,
    };
  },

  toJSON(message: ReadRelationshipsRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    message.relationshipFilter !== undefined && (obj.relationshipFilter = message.relationshipFilter
      ? RelationshipFilter.toJSON(message.relationshipFilter)
      : undefined);
    message.optionalLimit !== undefined && (obj.optionalLimit = Math.round(message.optionalLimit));
    message.optionalCursor !== undefined &&
      (obj.optionalCursor = message.optionalCursor ? Cursor.toJSON(message.optionalCursor) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ReadRelationshipsRequest>): ReadRelationshipsRequest {
    const message = createBaseReadRelationshipsRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.relationshipFilter = (object.relationshipFilter !== undefined && object.relationshipFilter !== null)
      ? RelationshipFilter.fromPartial(object.relationshipFilter)
      : undefined;
    message.optionalLimit = object.optionalLimit ?? 0;
    message.optionalCursor = (object.optionalCursor !== undefined && object.optionalCursor !== null)
      ? Cursor.fromPartial(object.optionalCursor)
      : undefined;
    return message;
  },
};

function createBaseReadRelationshipsResponse(): ReadRelationshipsResponse {
  return { readAt: undefined, relationship: undefined, afterResultCursor: undefined };
}

export const ReadRelationshipsResponse = {
  encode(message: ReadRelationshipsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.readAt !== undefined) {
      ZedToken.encode(message.readAt, writer.uint32(10).fork()).ldelim();
    }
    if (message.relationship !== undefined) {
      Relationship.encode(message.relationship, writer.uint32(18).fork()).ldelim();
    }
    if (message.afterResultCursor !== undefined) {
      Cursor.encode(message.afterResultCursor, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReadRelationshipsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReadRelationshipsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.readAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.relationship = Relationship.decode(reader, reader.uint32());
          break;
        case 3:
          message.afterResultCursor = Cursor.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ReadRelationshipsResponse {
    return {
      readAt: isSet(object.readAt) ? ZedToken.fromJSON(object.readAt) : undefined,
      relationship: isSet(object.relationship) ? Relationship.fromJSON(object.relationship) : undefined,
      afterResultCursor: isSet(object.afterResultCursor) ? Cursor.fromJSON(object.afterResultCursor) : undefined,
    };
  },

  toJSON(message: ReadRelationshipsResponse): unknown {
    const obj: any = {};
    message.readAt !== undefined && (obj.readAt = message.readAt ? ZedToken.toJSON(message.readAt) : undefined);
    message.relationship !== undefined &&
      (obj.relationship = message.relationship ? Relationship.toJSON(message.relationship) : undefined);
    message.afterResultCursor !== undefined &&
      (obj.afterResultCursor = message.afterResultCursor ? Cursor.toJSON(message.afterResultCursor) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ReadRelationshipsResponse>): ReadRelationshipsResponse {
    const message = createBaseReadRelationshipsResponse();
    message.readAt = (object.readAt !== undefined && object.readAt !== null)
      ? ZedToken.fromPartial(object.readAt)
      : undefined;
    message.relationship = (object.relationship !== undefined && object.relationship !== null)
      ? Relationship.fromPartial(object.relationship)
      : undefined;
    message.afterResultCursor = (object.afterResultCursor !== undefined && object.afterResultCursor !== null)
      ? Cursor.fromPartial(object.afterResultCursor)
      : undefined;
    return message;
  },
};

function createBasePrecondition(): Precondition {
  return { operation: Precondition_Operation.OPERATION_UNSPECIFIED, filter: undefined };
}

export const Precondition = {
  encode(message: Precondition, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.operation !== Precondition_Operation.OPERATION_UNSPECIFIED) {
      writer.uint32(8).int32(precondition_OperationToNumber(message.operation));
    }
    if (message.filter !== undefined) {
      RelationshipFilter.encode(message.filter, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Precondition {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePrecondition();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.operation = precondition_OperationFromJSON(reader.int32());
          break;
        case 2:
          message.filter = RelationshipFilter.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Precondition {
    return {
      operation: isSet(object.operation)
        ? precondition_OperationFromJSON(object.operation)
        : Precondition_Operation.OPERATION_UNSPECIFIED,
      filter: isSet(object.filter) ? RelationshipFilter.fromJSON(object.filter) : undefined,
    };
  },

  toJSON(message: Precondition): unknown {
    const obj: any = {};
    message.operation !== undefined && (obj.operation = precondition_OperationToJSON(message.operation));
    message.filter !== undefined &&
      (obj.filter = message.filter ? RelationshipFilter.toJSON(message.filter) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<Precondition>): Precondition {
    const message = createBasePrecondition();
    message.operation = object.operation ?? Precondition_Operation.OPERATION_UNSPECIFIED;
    message.filter = (object.filter !== undefined && object.filter !== null)
      ? RelationshipFilter.fromPartial(object.filter)
      : undefined;
    return message;
  },
};

function createBaseWriteRelationshipsRequest(): WriteRelationshipsRequest {
  return { updates: [], optionalPreconditions: [] };
}

export const WriteRelationshipsRequest = {
  encode(message: WriteRelationshipsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.updates) {
      RelationshipUpdate.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.optionalPreconditions) {
      Precondition.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WriteRelationshipsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWriteRelationshipsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.updates.push(RelationshipUpdate.decode(reader, reader.uint32()));
          break;
        case 2:
          message.optionalPreconditions.push(Precondition.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteRelationshipsRequest {
    return {
      updates: Array.isArray(object?.updates) ? object.updates.map((e: any) => RelationshipUpdate.fromJSON(e)) : [],
      optionalPreconditions: Array.isArray(object?.optionalPreconditions)
        ? object.optionalPreconditions.map((e: any) => Precondition.fromJSON(e))
        : [],
    };
  },

  toJSON(message: WriteRelationshipsRequest): unknown {
    const obj: any = {};
    if (message.updates) {
      obj.updates = message.updates.map((e) => e ? RelationshipUpdate.toJSON(e) : undefined);
    } else {
      obj.updates = [];
    }
    if (message.optionalPreconditions) {
      obj.optionalPreconditions = message.optionalPreconditions.map((e) => e ? Precondition.toJSON(e) : undefined);
    } else {
      obj.optionalPreconditions = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<WriteRelationshipsRequest>): WriteRelationshipsRequest {
    const message = createBaseWriteRelationshipsRequest();
    message.updates = object.updates?.map((e) => RelationshipUpdate.fromPartial(e)) || [];
    message.optionalPreconditions = object.optionalPreconditions?.map((e) => Precondition.fromPartial(e)) || [];
    return message;
  },
};

function createBaseWriteRelationshipsResponse(): WriteRelationshipsResponse {
  return { writtenAt: undefined };
}

export const WriteRelationshipsResponse = {
  encode(message: WriteRelationshipsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.writtenAt !== undefined) {
      ZedToken.encode(message.writtenAt, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WriteRelationshipsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWriteRelationshipsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.writtenAt = ZedToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteRelationshipsResponse {
    return { writtenAt: isSet(object.writtenAt) ? ZedToken.fromJSON(object.writtenAt) : undefined };
  },

  toJSON(message: WriteRelationshipsResponse): unknown {
    const obj: any = {};
    message.writtenAt !== undefined &&
      (obj.writtenAt = message.writtenAt ? ZedToken.toJSON(message.writtenAt) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<WriteRelationshipsResponse>): WriteRelationshipsResponse {
    const message = createBaseWriteRelationshipsResponse();
    message.writtenAt = (object.writtenAt !== undefined && object.writtenAt !== null)
      ? ZedToken.fromPartial(object.writtenAt)
      : undefined;
    return message;
  },
};

function createBaseDeleteRelationshipsRequest(): DeleteRelationshipsRequest {
  return {
    relationshipFilter: undefined,
    optionalPreconditions: [],
    optionalLimit: 0,
    optionalAllowPartialDeletions: false,
  };
}

export const DeleteRelationshipsRequest = {
  encode(message: DeleteRelationshipsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.relationshipFilter !== undefined) {
      RelationshipFilter.encode(message.relationshipFilter, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.optionalPreconditions) {
      Precondition.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.optionalLimit !== 0) {
      writer.uint32(24).uint32(message.optionalLimit);
    }
    if (message.optionalAllowPartialDeletions === true) {
      writer.uint32(32).bool(message.optionalAllowPartialDeletions);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteRelationshipsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteRelationshipsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.relationshipFilter = RelationshipFilter.decode(reader, reader.uint32());
          break;
        case 2:
          message.optionalPreconditions.push(Precondition.decode(reader, reader.uint32()));
          break;
        case 3:
          message.optionalLimit = reader.uint32();
          break;
        case 4:
          message.optionalAllowPartialDeletions = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeleteRelationshipsRequest {
    return {
      relationshipFilter: isSet(object.relationshipFilter)
        ? RelationshipFilter.fromJSON(object.relationshipFilter)
        : undefined,
      optionalPreconditions: Array.isArray(object?.optionalPreconditions)
        ? object.optionalPreconditions.map((e: any) => Precondition.fromJSON(e))
        : [],
      optionalLimit: isSet(object.optionalLimit) ? Number(object.optionalLimit) : 0,
      optionalAllowPartialDeletions: isSet(object.optionalAllowPartialDeletions)
        ? Boolean(object.optionalAllowPartialDeletions)
        : false,
    };
  },

  toJSON(message: DeleteRelationshipsRequest): unknown {
    const obj: any = {};
    message.relationshipFilter !== undefined && (obj.relationshipFilter = message.relationshipFilter
      ? RelationshipFilter.toJSON(message.relationshipFilter)
      : undefined);
    if (message.optionalPreconditions) {
      obj.optionalPreconditions = message.optionalPreconditions.map((e) => e ? Precondition.toJSON(e) : undefined);
    } else {
      obj.optionalPreconditions = [];
    }
    message.optionalLimit !== undefined && (obj.optionalLimit = Math.round(message.optionalLimit));
    message.optionalAllowPartialDeletions !== undefined &&
      (obj.optionalAllowPartialDeletions = message.optionalAllowPartialDeletions);
    return obj;
  },

  fromPartial(object: DeepPartial<DeleteRelationshipsRequest>): DeleteRelationshipsRequest {
    const message = createBaseDeleteRelationshipsRequest();
    message.relationshipFilter = (object.relationshipFilter !== undefined && object.relationshipFilter !== null)
      ? RelationshipFilter.fromPartial(object.relationshipFilter)
      : undefined;
    message.optionalPreconditions = object.optionalPreconditions?.map((e) => Precondition.fromPartial(e)) || [];
    message.optionalLimit = object.optionalLimit ?? 0;
    message.optionalAllowPartialDeletions = object.optionalAllowPartialDeletions ?? false;
    return message;
  },
};

function createBaseDeleteRelationshipsResponse(): DeleteRelationshipsResponse {
  return {
    deletedAt: undefined,
    deletionProgress: DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_UNSPECIFIED,
  };
}

export const DeleteRelationshipsResponse = {
  encode(message: DeleteRelationshipsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.deletedAt !== undefined) {
      ZedToken.encode(message.deletedAt, writer.uint32(10).fork()).ldelim();
    }
    if (message.deletionProgress !== DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_UNSPECIFIED) {
      writer.uint32(16).int32(deleteRelationshipsResponse_DeletionProgressToNumber(message.deletionProgress));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteRelationshipsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteRelationshipsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.deletedAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.deletionProgress = deleteRelationshipsResponse_DeletionProgressFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeleteRelationshipsResponse {
    return {
      deletedAt: isSet(object.deletedAt) ? ZedToken.fromJSON(object.deletedAt) : undefined,
      deletionProgress: isSet(object.deletionProgress)
        ? deleteRelationshipsResponse_DeletionProgressFromJSON(object.deletionProgress)
        : DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_UNSPECIFIED,
    };
  },

  toJSON(message: DeleteRelationshipsResponse): unknown {
    const obj: any = {};
    message.deletedAt !== undefined &&
      (obj.deletedAt = message.deletedAt ? ZedToken.toJSON(message.deletedAt) : undefined);
    message.deletionProgress !== undefined &&
      (obj.deletionProgress = deleteRelationshipsResponse_DeletionProgressToJSON(message.deletionProgress));
    return obj;
  },

  fromPartial(object: DeepPartial<DeleteRelationshipsResponse>): DeleteRelationshipsResponse {
    const message = createBaseDeleteRelationshipsResponse();
    message.deletedAt = (object.deletedAt !== undefined && object.deletedAt !== null)
      ? ZedToken.fromPartial(object.deletedAt)
      : undefined;
    message.deletionProgress = object.deletionProgress ??
      DeleteRelationshipsResponse_DeletionProgress.DELETION_PROGRESS_UNSPECIFIED;
    return message;
  },
};

function createBaseCheckPermissionRequest(): CheckPermissionRequest {
  return { consistency: undefined, resource: undefined, permission: "", subject: undefined, context: undefined };
}

export const CheckPermissionRequest = {
  encode(message: CheckPermissionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    if (message.resource !== undefined) {
      ObjectReference.encode(message.resource, writer.uint32(18).fork()).ldelim();
    }
    if (message.permission !== "") {
      writer.uint32(26).string(message.permission);
    }
    if (message.subject !== undefined) {
      SubjectReference.encode(message.subject, writer.uint32(34).fork()).ldelim();
    }
    if (message.context !== undefined) {
      Struct.encode(Struct.wrap(message.context), writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CheckPermissionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCheckPermissionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.resource = ObjectReference.decode(reader, reader.uint32());
          break;
        case 3:
          message.permission = reader.string();
          break;
        case 4:
          message.subject = SubjectReference.decode(reader, reader.uint32());
          break;
        case 5:
          message.context = Struct.unwrap(Struct.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CheckPermissionRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      resource: isSet(object.resource) ? ObjectReference.fromJSON(object.resource) : undefined,
      permission: isSet(object.permission) ? String(object.permission) : "",
      subject: isSet(object.subject) ? SubjectReference.fromJSON(object.subject) : undefined,
      context: isObject(object.context) ? object.context : undefined,
    };
  },

  toJSON(message: CheckPermissionRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    message.resource !== undefined &&
      (obj.resource = message.resource ? ObjectReference.toJSON(message.resource) : undefined);
    message.permission !== undefined && (obj.permission = message.permission);
    message.subject !== undefined &&
      (obj.subject = message.subject ? SubjectReference.toJSON(message.subject) : undefined);
    message.context !== undefined && (obj.context = message.context);
    return obj;
  },

  fromPartial(object: DeepPartial<CheckPermissionRequest>): CheckPermissionRequest {
    const message = createBaseCheckPermissionRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.resource = (object.resource !== undefined && object.resource !== null)
      ? ObjectReference.fromPartial(object.resource)
      : undefined;
    message.permission = object.permission ?? "";
    message.subject = (object.subject !== undefined && object.subject !== null)
      ? SubjectReference.fromPartial(object.subject)
      : undefined;
    message.context = object.context ?? undefined;
    return message;
  },
};

function createBaseCheckPermissionResponse(): CheckPermissionResponse {
  return {
    checkedAt: undefined,
    permissionship: CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
    partialCaveatInfo: undefined,
  };
}

export const CheckPermissionResponse = {
  encode(message: CheckPermissionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.checkedAt !== undefined) {
      ZedToken.encode(message.checkedAt, writer.uint32(10).fork()).ldelim();
    }
    if (message.permissionship !== CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED) {
      writer.uint32(16).int32(checkPermissionResponse_PermissionshipToNumber(message.permissionship));
    }
    if (message.partialCaveatInfo !== undefined) {
      PartialCaveatInfo.encode(message.partialCaveatInfo, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CheckPermissionResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCheckPermissionResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.checkedAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.permissionship = checkPermissionResponse_PermissionshipFromJSON(reader.int32());
          break;
        case 3:
          message.partialCaveatInfo = PartialCaveatInfo.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CheckPermissionResponse {
    return {
      checkedAt: isSet(object.checkedAt) ? ZedToken.fromJSON(object.checkedAt) : undefined,
      permissionship: isSet(object.permissionship)
        ? checkPermissionResponse_PermissionshipFromJSON(object.permissionship)
        : CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
      partialCaveatInfo: isSet(object.partialCaveatInfo)
        ? PartialCaveatInfo.fromJSON(object.partialCaveatInfo)
        : undefined,
    };
  },

  toJSON(message: CheckPermissionResponse): unknown {
    const obj: any = {};
    message.checkedAt !== undefined &&
      (obj.checkedAt = message.checkedAt ? ZedToken.toJSON(message.checkedAt) : undefined);
    message.permissionship !== undefined &&
      (obj.permissionship = checkPermissionResponse_PermissionshipToJSON(message.permissionship));
    message.partialCaveatInfo !== undefined && (obj.partialCaveatInfo = message.partialCaveatInfo
      ? PartialCaveatInfo.toJSON(message.partialCaveatInfo)
      : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<CheckPermissionResponse>): CheckPermissionResponse {
    const message = createBaseCheckPermissionResponse();
    message.checkedAt = (object.checkedAt !== undefined && object.checkedAt !== null)
      ? ZedToken.fromPartial(object.checkedAt)
      : undefined;
    message.permissionship = object.permissionship ?? CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED;
    message.partialCaveatInfo = (object.partialCaveatInfo !== undefined && object.partialCaveatInfo !== null)
      ? PartialCaveatInfo.fromPartial(object.partialCaveatInfo)
      : undefined;
    return message;
  },
};

function createBaseExpandPermissionTreeRequest(): ExpandPermissionTreeRequest {
  return { consistency: undefined, resource: undefined, permission: "" };
}

export const ExpandPermissionTreeRequest = {
  encode(message: ExpandPermissionTreeRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    if (message.resource !== undefined) {
      ObjectReference.encode(message.resource, writer.uint32(18).fork()).ldelim();
    }
    if (message.permission !== "") {
      writer.uint32(26).string(message.permission);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ExpandPermissionTreeRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseExpandPermissionTreeRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.resource = ObjectReference.decode(reader, reader.uint32());
          break;
        case 3:
          message.permission = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ExpandPermissionTreeRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      resource: isSet(object.resource) ? ObjectReference.fromJSON(object.resource) : undefined,
      permission: isSet(object.permission) ? String(object.permission) : "",
    };
  },

  toJSON(message: ExpandPermissionTreeRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    message.resource !== undefined &&
      (obj.resource = message.resource ? ObjectReference.toJSON(message.resource) : undefined);
    message.permission !== undefined && (obj.permission = message.permission);
    return obj;
  },

  fromPartial(object: DeepPartial<ExpandPermissionTreeRequest>): ExpandPermissionTreeRequest {
    const message = createBaseExpandPermissionTreeRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.resource = (object.resource !== undefined && object.resource !== null)
      ? ObjectReference.fromPartial(object.resource)
      : undefined;
    message.permission = object.permission ?? "";
    return message;
  },
};

function createBaseExpandPermissionTreeResponse(): ExpandPermissionTreeResponse {
  return { expandedAt: undefined, treeRoot: undefined };
}

export const ExpandPermissionTreeResponse = {
  encode(message: ExpandPermissionTreeResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.expandedAt !== undefined) {
      ZedToken.encode(message.expandedAt, writer.uint32(10).fork()).ldelim();
    }
    if (message.treeRoot !== undefined) {
      PermissionRelationshipTree.encode(message.treeRoot, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ExpandPermissionTreeResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseExpandPermissionTreeResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.expandedAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.treeRoot = PermissionRelationshipTree.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ExpandPermissionTreeResponse {
    return {
      expandedAt: isSet(object.expandedAt) ? ZedToken.fromJSON(object.expandedAt) : undefined,
      treeRoot: isSet(object.treeRoot) ? PermissionRelationshipTree.fromJSON(object.treeRoot) : undefined,
    };
  },

  toJSON(message: ExpandPermissionTreeResponse): unknown {
    const obj: any = {};
    message.expandedAt !== undefined &&
      (obj.expandedAt = message.expandedAt ? ZedToken.toJSON(message.expandedAt) : undefined);
    message.treeRoot !== undefined &&
      (obj.treeRoot = message.treeRoot ? PermissionRelationshipTree.toJSON(message.treeRoot) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ExpandPermissionTreeResponse>): ExpandPermissionTreeResponse {
    const message = createBaseExpandPermissionTreeResponse();
    message.expandedAt = (object.expandedAt !== undefined && object.expandedAt !== null)
      ? ZedToken.fromPartial(object.expandedAt)
      : undefined;
    message.treeRoot = (object.treeRoot !== undefined && object.treeRoot !== null)
      ? PermissionRelationshipTree.fromPartial(object.treeRoot)
      : undefined;
    return message;
  },
};

function createBaseLookupResourcesRequest(): LookupResourcesRequest {
  return {
    consistency: undefined,
    resourceObjectType: "",
    permission: "",
    subject: undefined,
    context: undefined,
    optionalLimit: 0,
    optionalCursor: undefined,
  };
}

export const LookupResourcesRequest = {
  encode(message: LookupResourcesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    if (message.resourceObjectType !== "") {
      writer.uint32(18).string(message.resourceObjectType);
    }
    if (message.permission !== "") {
      writer.uint32(26).string(message.permission);
    }
    if (message.subject !== undefined) {
      SubjectReference.encode(message.subject, writer.uint32(34).fork()).ldelim();
    }
    if (message.context !== undefined) {
      Struct.encode(Struct.wrap(message.context), writer.uint32(42).fork()).ldelim();
    }
    if (message.optionalLimit !== 0) {
      writer.uint32(48).uint32(message.optionalLimit);
    }
    if (message.optionalCursor !== undefined) {
      Cursor.encode(message.optionalCursor, writer.uint32(58).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LookupResourcesRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLookupResourcesRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.resourceObjectType = reader.string();
          break;
        case 3:
          message.permission = reader.string();
          break;
        case 4:
          message.subject = SubjectReference.decode(reader, reader.uint32());
          break;
        case 5:
          message.context = Struct.unwrap(Struct.decode(reader, reader.uint32()));
          break;
        case 6:
          message.optionalLimit = reader.uint32();
          break;
        case 7:
          message.optionalCursor = Cursor.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LookupResourcesRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      resourceObjectType: isSet(object.resourceObjectType) ? String(object.resourceObjectType) : "",
      permission: isSet(object.permission) ? String(object.permission) : "",
      subject: isSet(object.subject) ? SubjectReference.fromJSON(object.subject) : undefined,
      context: isObject(object.context) ? object.context : undefined,
      optionalLimit: isSet(object.optionalLimit) ? Number(object.optionalLimit) : 0,
      optionalCursor: isSet(object.optionalCursor) ? Cursor.fromJSON(object.optionalCursor) : undefined,
    };
  },

  toJSON(message: LookupResourcesRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    message.resourceObjectType !== undefined && (obj.resourceObjectType = message.resourceObjectType);
    message.permission !== undefined && (obj.permission = message.permission);
    message.subject !== undefined &&
      (obj.subject = message.subject ? SubjectReference.toJSON(message.subject) : undefined);
    message.context !== undefined && (obj.context = message.context);
    message.optionalLimit !== undefined && (obj.optionalLimit = Math.round(message.optionalLimit));
    message.optionalCursor !== undefined &&
      (obj.optionalCursor = message.optionalCursor ? Cursor.toJSON(message.optionalCursor) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<LookupResourcesRequest>): LookupResourcesRequest {
    const message = createBaseLookupResourcesRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.resourceObjectType = object.resourceObjectType ?? "";
    message.permission = object.permission ?? "";
    message.subject = (object.subject !== undefined && object.subject !== null)
      ? SubjectReference.fromPartial(object.subject)
      : undefined;
    message.context = object.context ?? undefined;
    message.optionalLimit = object.optionalLimit ?? 0;
    message.optionalCursor = (object.optionalCursor !== undefined && object.optionalCursor !== null)
      ? Cursor.fromPartial(object.optionalCursor)
      : undefined;
    return message;
  },
};

function createBaseLookupResourcesResponse(): LookupResourcesResponse {
  return {
    lookedUpAt: undefined,
    resourceObjectId: "",
    permissionship: LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED,
    partialCaveatInfo: undefined,
    afterResultCursor: undefined,
  };
}

export const LookupResourcesResponse = {
  encode(message: LookupResourcesResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.lookedUpAt !== undefined) {
      ZedToken.encode(message.lookedUpAt, writer.uint32(10).fork()).ldelim();
    }
    if (message.resourceObjectId !== "") {
      writer.uint32(18).string(message.resourceObjectId);
    }
    if (message.permissionship !== LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED) {
      writer.uint32(24).int32(lookupPermissionshipToNumber(message.permissionship));
    }
    if (message.partialCaveatInfo !== undefined) {
      PartialCaveatInfo.encode(message.partialCaveatInfo, writer.uint32(34).fork()).ldelim();
    }
    if (message.afterResultCursor !== undefined) {
      Cursor.encode(message.afterResultCursor, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LookupResourcesResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLookupResourcesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.lookedUpAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.resourceObjectId = reader.string();
          break;
        case 3:
          message.permissionship = lookupPermissionshipFromJSON(reader.int32());
          break;
        case 4:
          message.partialCaveatInfo = PartialCaveatInfo.decode(reader, reader.uint32());
          break;
        case 5:
          message.afterResultCursor = Cursor.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LookupResourcesResponse {
    return {
      lookedUpAt: isSet(object.lookedUpAt) ? ZedToken.fromJSON(object.lookedUpAt) : undefined,
      resourceObjectId: isSet(object.resourceObjectId) ? String(object.resourceObjectId) : "",
      permissionship: isSet(object.permissionship)
        ? lookupPermissionshipFromJSON(object.permissionship)
        : LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED,
      partialCaveatInfo: isSet(object.partialCaveatInfo)
        ? PartialCaveatInfo.fromJSON(object.partialCaveatInfo)
        : undefined,
      afterResultCursor: isSet(object.afterResultCursor) ? Cursor.fromJSON(object.afterResultCursor) : undefined,
    };
  },

  toJSON(message: LookupResourcesResponse): unknown {
    const obj: any = {};
    message.lookedUpAt !== undefined &&
      (obj.lookedUpAt = message.lookedUpAt ? ZedToken.toJSON(message.lookedUpAt) : undefined);
    message.resourceObjectId !== undefined && (obj.resourceObjectId = message.resourceObjectId);
    message.permissionship !== undefined && (obj.permissionship = lookupPermissionshipToJSON(message.permissionship));
    message.partialCaveatInfo !== undefined && (obj.partialCaveatInfo = message.partialCaveatInfo
      ? PartialCaveatInfo.toJSON(message.partialCaveatInfo)
      : undefined);
    message.afterResultCursor !== undefined &&
      (obj.afterResultCursor = message.afterResultCursor ? Cursor.toJSON(message.afterResultCursor) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<LookupResourcesResponse>): LookupResourcesResponse {
    const message = createBaseLookupResourcesResponse();
    message.lookedUpAt = (object.lookedUpAt !== undefined && object.lookedUpAt !== null)
      ? ZedToken.fromPartial(object.lookedUpAt)
      : undefined;
    message.resourceObjectId = object.resourceObjectId ?? "";
    message.permissionship = object.permissionship ?? LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED;
    message.partialCaveatInfo = (object.partialCaveatInfo !== undefined && object.partialCaveatInfo !== null)
      ? PartialCaveatInfo.fromPartial(object.partialCaveatInfo)
      : undefined;
    message.afterResultCursor = (object.afterResultCursor !== undefined && object.afterResultCursor !== null)
      ? Cursor.fromPartial(object.afterResultCursor)
      : undefined;
    return message;
  },
};

function createBaseLookupSubjectsRequest(): LookupSubjectsRequest {
  return {
    consistency: undefined,
    resource: undefined,
    permission: "",
    subjectObjectType: "",
    optionalSubjectRelation: "",
    context: undefined,
    optionalConcreteLimit: 0,
    optionalCursor: undefined,
    wildcardOption: LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_UNSPECIFIED,
  };
}

export const LookupSubjectsRequest = {
  encode(message: LookupSubjectsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    if (message.resource !== undefined) {
      ObjectReference.encode(message.resource, writer.uint32(18).fork()).ldelim();
    }
    if (message.permission !== "") {
      writer.uint32(26).string(message.permission);
    }
    if (message.subjectObjectType !== "") {
      writer.uint32(34).string(message.subjectObjectType);
    }
    if (message.optionalSubjectRelation !== "") {
      writer.uint32(42).string(message.optionalSubjectRelation);
    }
    if (message.context !== undefined) {
      Struct.encode(Struct.wrap(message.context), writer.uint32(50).fork()).ldelim();
    }
    if (message.optionalConcreteLimit !== 0) {
      writer.uint32(56).uint32(message.optionalConcreteLimit);
    }
    if (message.optionalCursor !== undefined) {
      Cursor.encode(message.optionalCursor, writer.uint32(66).fork()).ldelim();
    }
    if (message.wildcardOption !== LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_UNSPECIFIED) {
      writer.uint32(72).int32(lookupSubjectsRequest_WildcardOptionToNumber(message.wildcardOption));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LookupSubjectsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLookupSubjectsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.resource = ObjectReference.decode(reader, reader.uint32());
          break;
        case 3:
          message.permission = reader.string();
          break;
        case 4:
          message.subjectObjectType = reader.string();
          break;
        case 5:
          message.optionalSubjectRelation = reader.string();
          break;
        case 6:
          message.context = Struct.unwrap(Struct.decode(reader, reader.uint32()));
          break;
        case 7:
          message.optionalConcreteLimit = reader.uint32();
          break;
        case 8:
          message.optionalCursor = Cursor.decode(reader, reader.uint32());
          break;
        case 9:
          message.wildcardOption = lookupSubjectsRequest_WildcardOptionFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LookupSubjectsRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      resource: isSet(object.resource) ? ObjectReference.fromJSON(object.resource) : undefined,
      permission: isSet(object.permission) ? String(object.permission) : "",
      subjectObjectType: isSet(object.subjectObjectType) ? String(object.subjectObjectType) : "",
      optionalSubjectRelation: isSet(object.optionalSubjectRelation) ? String(object.optionalSubjectRelation) : "",
      context: isObject(object.context) ? object.context : undefined,
      optionalConcreteLimit: isSet(object.optionalConcreteLimit) ? Number(object.optionalConcreteLimit) : 0,
      optionalCursor: isSet(object.optionalCursor) ? Cursor.fromJSON(object.optionalCursor) : undefined,
      wildcardOption: isSet(object.wildcardOption)
        ? lookupSubjectsRequest_WildcardOptionFromJSON(object.wildcardOption)
        : LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_UNSPECIFIED,
    };
  },

  toJSON(message: LookupSubjectsRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    message.resource !== undefined &&
      (obj.resource = message.resource ? ObjectReference.toJSON(message.resource) : undefined);
    message.permission !== undefined && (obj.permission = message.permission);
    message.subjectObjectType !== undefined && (obj.subjectObjectType = message.subjectObjectType);
    message.optionalSubjectRelation !== undefined && (obj.optionalSubjectRelation = message.optionalSubjectRelation);
    message.context !== undefined && (obj.context = message.context);
    message.optionalConcreteLimit !== undefined &&
      (obj.optionalConcreteLimit = Math.round(message.optionalConcreteLimit));
    message.optionalCursor !== undefined &&
      (obj.optionalCursor = message.optionalCursor ? Cursor.toJSON(message.optionalCursor) : undefined);
    message.wildcardOption !== undefined &&
      (obj.wildcardOption = lookupSubjectsRequest_WildcardOptionToJSON(message.wildcardOption));
    return obj;
  },

  fromPartial(object: DeepPartial<LookupSubjectsRequest>): LookupSubjectsRequest {
    const message = createBaseLookupSubjectsRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.resource = (object.resource !== undefined && object.resource !== null)
      ? ObjectReference.fromPartial(object.resource)
      : undefined;
    message.permission = object.permission ?? "";
    message.subjectObjectType = object.subjectObjectType ?? "";
    message.optionalSubjectRelation = object.optionalSubjectRelation ?? "";
    message.context = object.context ?? undefined;
    message.optionalConcreteLimit = object.optionalConcreteLimit ?? 0;
    message.optionalCursor = (object.optionalCursor !== undefined && object.optionalCursor !== null)
      ? Cursor.fromPartial(object.optionalCursor)
      : undefined;
    message.wildcardOption = object.wildcardOption ?? LookupSubjectsRequest_WildcardOption.WILDCARD_OPTION_UNSPECIFIED;
    return message;
  },
};

function createBaseLookupSubjectsResponse(): LookupSubjectsResponse {
  return {
    lookedUpAt: undefined,
    subjectObjectId: "",
    excludedSubjectIds: [],
    permissionship: LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED,
    partialCaveatInfo: undefined,
    subject: undefined,
    excludedSubjects: [],
    afterResultCursor: undefined,
  };
}

export const LookupSubjectsResponse = {
  encode(message: LookupSubjectsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.lookedUpAt !== undefined) {
      ZedToken.encode(message.lookedUpAt, writer.uint32(10).fork()).ldelim();
    }
    if (message.subjectObjectId !== "") {
      writer.uint32(18).string(message.subjectObjectId);
    }
    for (const v of message.excludedSubjectIds) {
      writer.uint32(26).string(v!);
    }
    if (message.permissionship !== LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED) {
      writer.uint32(32).int32(lookupPermissionshipToNumber(message.permissionship));
    }
    if (message.partialCaveatInfo !== undefined) {
      PartialCaveatInfo.encode(message.partialCaveatInfo, writer.uint32(42).fork()).ldelim();
    }
    if (message.subject !== undefined) {
      ResolvedSubject.encode(message.subject, writer.uint32(50).fork()).ldelim();
    }
    for (const v of message.excludedSubjects) {
      ResolvedSubject.encode(v!, writer.uint32(58).fork()).ldelim();
    }
    if (message.afterResultCursor !== undefined) {
      Cursor.encode(message.afterResultCursor, writer.uint32(66).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LookupSubjectsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLookupSubjectsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.lookedUpAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.subjectObjectId = reader.string();
          break;
        case 3:
          message.excludedSubjectIds.push(reader.string());
          break;
        case 4:
          message.permissionship = lookupPermissionshipFromJSON(reader.int32());
          break;
        case 5:
          message.partialCaveatInfo = PartialCaveatInfo.decode(reader, reader.uint32());
          break;
        case 6:
          message.subject = ResolvedSubject.decode(reader, reader.uint32());
          break;
        case 7:
          message.excludedSubjects.push(ResolvedSubject.decode(reader, reader.uint32()));
          break;
        case 8:
          message.afterResultCursor = Cursor.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LookupSubjectsResponse {
    return {
      lookedUpAt: isSet(object.lookedUpAt) ? ZedToken.fromJSON(object.lookedUpAt) : undefined,
      subjectObjectId: isSet(object.subjectObjectId) ? String(object.subjectObjectId) : "",
      excludedSubjectIds: Array.isArray(object?.excludedSubjectIds)
        ? object.excludedSubjectIds.map((e: any) => String(e))
        : [],
      permissionship: isSet(object.permissionship)
        ? lookupPermissionshipFromJSON(object.permissionship)
        : LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED,
      partialCaveatInfo: isSet(object.partialCaveatInfo)
        ? PartialCaveatInfo.fromJSON(object.partialCaveatInfo)
        : undefined,
      subject: isSet(object.subject) ? ResolvedSubject.fromJSON(object.subject) : undefined,
      excludedSubjects: Array.isArray(object?.excludedSubjects)
        ? object.excludedSubjects.map((e: any) => ResolvedSubject.fromJSON(e))
        : [],
      afterResultCursor: isSet(object.afterResultCursor) ? Cursor.fromJSON(object.afterResultCursor) : undefined,
    };
  },

  toJSON(message: LookupSubjectsResponse): unknown {
    const obj: any = {};
    message.lookedUpAt !== undefined &&
      (obj.lookedUpAt = message.lookedUpAt ? ZedToken.toJSON(message.lookedUpAt) : undefined);
    message.subjectObjectId !== undefined && (obj.subjectObjectId = message.subjectObjectId);
    if (message.excludedSubjectIds) {
      obj.excludedSubjectIds = message.excludedSubjectIds.map((e) => e);
    } else {
      obj.excludedSubjectIds = [];
    }
    message.permissionship !== undefined && (obj.permissionship = lookupPermissionshipToJSON(message.permissionship));
    message.partialCaveatInfo !== undefined && (obj.partialCaveatInfo = message.partialCaveatInfo
      ? PartialCaveatInfo.toJSON(message.partialCaveatInfo)
      : undefined);
    message.subject !== undefined &&
      (obj.subject = message.subject ? ResolvedSubject.toJSON(message.subject) : undefined);
    if (message.excludedSubjects) {
      obj.excludedSubjects = message.excludedSubjects.map((e) => e ? ResolvedSubject.toJSON(e) : undefined);
    } else {
      obj.excludedSubjects = [];
    }
    message.afterResultCursor !== undefined &&
      (obj.afterResultCursor = message.afterResultCursor ? Cursor.toJSON(message.afterResultCursor) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<LookupSubjectsResponse>): LookupSubjectsResponse {
    const message = createBaseLookupSubjectsResponse();
    message.lookedUpAt = (object.lookedUpAt !== undefined && object.lookedUpAt !== null)
      ? ZedToken.fromPartial(object.lookedUpAt)
      : undefined;
    message.subjectObjectId = object.subjectObjectId ?? "";
    message.excludedSubjectIds = object.excludedSubjectIds?.map((e) => e) || [];
    message.permissionship = object.permissionship ?? LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED;
    message.partialCaveatInfo = (object.partialCaveatInfo !== undefined && object.partialCaveatInfo !== null)
      ? PartialCaveatInfo.fromPartial(object.partialCaveatInfo)
      : undefined;
    message.subject = (object.subject !== undefined && object.subject !== null)
      ? ResolvedSubject.fromPartial(object.subject)
      : undefined;
    message.excludedSubjects = object.excludedSubjects?.map((e) => ResolvedSubject.fromPartial(e)) || [];
    message.afterResultCursor = (object.afterResultCursor !== undefined && object.afterResultCursor !== null)
      ? Cursor.fromPartial(object.afterResultCursor)
      : undefined;
    return message;
  },
};

function createBaseResolvedSubject(): ResolvedSubject {
  return {
    subjectObjectId: "",
    permissionship: LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED,
    partialCaveatInfo: undefined,
  };
}

export const ResolvedSubject = {
  encode(message: ResolvedSubject, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.subjectObjectId !== "") {
      writer.uint32(10).string(message.subjectObjectId);
    }
    if (message.permissionship !== LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED) {
      writer.uint32(16).int32(lookupPermissionshipToNumber(message.permissionship));
    }
    if (message.partialCaveatInfo !== undefined) {
      PartialCaveatInfo.encode(message.partialCaveatInfo, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResolvedSubject {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResolvedSubject();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.subjectObjectId = reader.string();
          break;
        case 2:
          message.permissionship = lookupPermissionshipFromJSON(reader.int32());
          break;
        case 3:
          message.partialCaveatInfo = PartialCaveatInfo.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ResolvedSubject {
    return {
      subjectObjectId: isSet(object.subjectObjectId) ? String(object.subjectObjectId) : "",
      permissionship: isSet(object.permissionship)
        ? lookupPermissionshipFromJSON(object.permissionship)
        : LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED,
      partialCaveatInfo: isSet(object.partialCaveatInfo)
        ? PartialCaveatInfo.fromJSON(object.partialCaveatInfo)
        : undefined,
    };
  },

  toJSON(message: ResolvedSubject): unknown {
    const obj: any = {};
    message.subjectObjectId !== undefined && (obj.subjectObjectId = message.subjectObjectId);
    message.permissionship !== undefined && (obj.permissionship = lookupPermissionshipToJSON(message.permissionship));
    message.partialCaveatInfo !== undefined && (obj.partialCaveatInfo = message.partialCaveatInfo
      ? PartialCaveatInfo.toJSON(message.partialCaveatInfo)
      : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ResolvedSubject>): ResolvedSubject {
    const message = createBaseResolvedSubject();
    message.subjectObjectId = object.subjectObjectId ?? "";
    message.permissionship = object.permissionship ?? LookupPermissionship.LOOKUP_PERMISSIONSHIP_UNSPECIFIED;
    message.partialCaveatInfo = (object.partialCaveatInfo !== undefined && object.partialCaveatInfo !== null)
      ? PartialCaveatInfo.fromPartial(object.partialCaveatInfo)
      : undefined;
    return message;
  },
};

/**
 * PermissionsService implements a set of RPCs that perform operations on
 * relationships and permissions.
 */
export type PermissionsServiceDefinition = typeof PermissionsServiceDefinition;
export const PermissionsServiceDefinition = {
  name: "PermissionsService",
  fullName: "authzed.api.v1.PermissionsService",
  methods: {
    /**
     * ReadRelationships reads a set of the relationships matching one or more
     * filters.
     */
    readRelationships: {
      name: "ReadRelationships",
      requestType: ReadRelationshipsRequest,
      requestStream: false,
      responseType: ReadRelationshipsResponse,
      responseStream: true,
      options: {},
    },
    /**
     * WriteRelationships atomically writes and/or deletes a set of specified
     * relationships. An optional set of preconditions can be provided that must
     * be satisfied for the operation to commit.
     */
    writeRelationships: {
      name: "WriteRelationships",
      requestType: WriteRelationshipsRequest,
      requestStream: false,
      responseType: WriteRelationshipsResponse,
      responseStream: false,
      options: {},
    },
    /**
     * DeleteRelationships atomically bulk deletes all relationships matching the
     * provided filter. If no relationships match, none will be deleted and the
     * operation will succeed. An optional set of preconditions can be provided that must
     * be satisfied for the operation to commit.
     */
    deleteRelationships: {
      name: "DeleteRelationships",
      requestType: DeleteRelationshipsRequest,
      requestStream: false,
      responseType: DeleteRelationshipsResponse,
      responseStream: false,
      options: {},
    },
    /**
     * CheckPermission determines for a given resource whether a subject computes
     * to having a permission or is a direct member of a particular relation.
     */
    checkPermission: {
      name: "CheckPermission",
      requestType: CheckPermissionRequest,
      requestStream: false,
      responseType: CheckPermissionResponse,
      responseStream: false,
      options: {},
    },
    /**
     * ExpandPermissionTree reveals the graph structure for a resource's
     * permission or relation. This RPC does not recurse infinitely deep and may
     * require multiple calls to fully unnest a deeply nested graph.
     */
    expandPermissionTree: {
      name: "ExpandPermissionTree",
      requestType: ExpandPermissionTreeRequest,
      requestStream: false,
      responseType: ExpandPermissionTreeResponse,
      responseStream: false,
      options: {},
    },
    /**
     * LookupResources returns all the resources of a given type that a subject
     * can access whether via a computed permission or relation membership.
     */
    lookupResources: {
      name: "LookupResources",
      requestType: LookupResourcesRequest,
      requestStream: false,
      responseType: LookupResourcesResponse,
      responseStream: true,
      options: {},
    },
    /**
     * LookupSubjects returns all the subjects of a given type that
     * have access whether via a computed permission or relation membership.
     */
    lookupSubjects: {
      name: "LookupSubjects",
      requestType: LookupSubjectsRequest,
      requestStream: false,
      responseType: LookupSubjectsResponse,
      responseStream: true,
      options: {},
    },
  },
} as const;

export interface PermissionsServiceServiceImplementation<CallContextExt = {}> {
  /**
   * ReadRelationships reads a set of the relationships matching one or more
   * filters.
   */
  readRelationships(
    request: ReadRelationshipsRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<ReadRelationshipsResponse>>;
  /**
   * WriteRelationships atomically writes and/or deletes a set of specified
   * relationships. An optional set of preconditions can be provided that must
   * be satisfied for the operation to commit.
   */
  writeRelationships(
    request: WriteRelationshipsRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<WriteRelationshipsResponse>>;
  /**
   * DeleteRelationships atomically bulk deletes all relationships matching the
   * provided filter. If no relationships match, none will be deleted and the
   * operation will succeed. An optional set of preconditions can be provided that must
   * be satisfied for the operation to commit.
   */
  deleteRelationships(
    request: DeleteRelationshipsRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<DeleteRelationshipsResponse>>;
  /**
   * CheckPermission determines for a given resource whether a subject computes
   * to having a permission or is a direct member of a particular relation.
   */
  checkPermission(
    request: CheckPermissionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CheckPermissionResponse>>;
  /**
   * ExpandPermissionTree reveals the graph structure for a resource's
   * permission or relation. This RPC does not recurse infinitely deep and may
   * require multiple calls to fully unnest a deeply nested graph.
   */
  expandPermissionTree(
    request: ExpandPermissionTreeRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ExpandPermissionTreeResponse>>;
  /**
   * LookupResources returns all the resources of a given type that a subject
   * can access whether via a computed permission or relation membership.
   */
  lookupResources(
    request: LookupResourcesRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<LookupResourcesResponse>>;
  /**
   * LookupSubjects returns all the subjects of a given type that
   * have access whether via a computed permission or relation membership.
   */
  lookupSubjects(
    request: LookupSubjectsRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<LookupSubjectsResponse>>;
}

export interface PermissionsServiceClient<CallOptionsExt = {}> {
  /**
   * ReadRelationships reads a set of the relationships matching one or more
   * filters.
   */
  readRelationships(
    request: DeepPartial<ReadRelationshipsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<ReadRelationshipsResponse>;
  /**
   * WriteRelationships atomically writes and/or deletes a set of specified
   * relationships. An optional set of preconditions can be provided that must
   * be satisfied for the operation to commit.
   */
  writeRelationships(
    request: DeepPartial<WriteRelationshipsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<WriteRelationshipsResponse>;
  /**
   * DeleteRelationships atomically bulk deletes all relationships matching the
   * provided filter. If no relationships match, none will be deleted and the
   * operation will succeed. An optional set of preconditions can be provided that must
   * be satisfied for the operation to commit.
   */
  deleteRelationships(
    request: DeepPartial<DeleteRelationshipsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<DeleteRelationshipsResponse>;
  /**
   * CheckPermission determines for a given resource whether a subject computes
   * to having a permission or is a direct member of a particular relation.
   */
  checkPermission(
    request: DeepPartial<CheckPermissionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CheckPermissionResponse>;
  /**
   * ExpandPermissionTree reveals the graph structure for a resource's
   * permission or relation. This RPC does not recurse infinitely deep and may
   * require multiple calls to fully unnest a deeply nested graph.
   */
  expandPermissionTree(
    request: DeepPartial<ExpandPermissionTreeRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ExpandPermissionTreeResponse>;
  /**
   * LookupResources returns all the resources of a given type that a subject
   * can access whether via a computed permission or relation membership.
   */
  lookupResources(
    request: DeepPartial<LookupResourcesRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<LookupResourcesResponse>;
  /**
   * LookupSubjects returns all the subjects of a given type that
   * have access whether via a computed permission or relation membership.
   */
  lookupSubjects(
    request: DeepPartial<LookupSubjectsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<LookupSubjectsResponse>;
}

export interface DataLoaderOptions {
  cache?: boolean;
}

export interface DataLoaders {
  rpcDataLoaderOptions?: DataLoaderOptions;
  getDataLoader<T>(identifier: string, constructorFn: () => T): T;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function isObject(value: any): boolean {
  return typeof value === "object" && value !== null;
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
