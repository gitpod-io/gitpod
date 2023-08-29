/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */

export const protobufPackage = "authzed.api.v1";

/**
 * Defines the supported values for `google.rpc.ErrorInfo.reason` for the
 * `authzed.com` error domain.
 */
export enum ErrorReason {
  /** ERROR_REASON_UNSPECIFIED - Do not use this default value. */
  ERROR_REASON_UNSPECIFIED = "ERROR_REASON_UNSPECIFIED",
  /**
   * ERROR_REASON_SCHEMA_PARSE_ERROR - The request gave a schema that could not be parsed.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_SCHEMA_PARSE_ERROR",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "start_line_number": "1",
   *         "start_column_position": "19",
   *         "end_line_number": "1",
   *         "end_column_position": "19",
   *         "source_code": "somedefinition",
   *       }
   *     }
   *
   * The line numbers and column positions are 0-indexed and may not be present.
   */
  ERROR_REASON_SCHEMA_PARSE_ERROR = "ERROR_REASON_SCHEMA_PARSE_ERROR",
  /**
   * ERROR_REASON_SCHEMA_TYPE_ERROR - The request contains a schema with a type error.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_SCHEMA_TYPE_ERROR",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "definition_name": "somedefinition",
   *         ... additional keys based on the kind of type error ...
   *       }
   *     }
   */
  ERROR_REASON_SCHEMA_TYPE_ERROR = "ERROR_REASON_SCHEMA_TYPE_ERROR",
  /**
   * ERROR_REASON_UNKNOWN_DEFINITION - The request referenced an unknown object definition in the schema.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_UNKNOWN_DEFINITION",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "definition_name": "somedefinition"
   *       }
   *     }
   */
  ERROR_REASON_UNKNOWN_DEFINITION = "ERROR_REASON_UNKNOWN_DEFINITION",
  /**
   * ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION - The request referenced an unknown relation or permission under a definition in the schema.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "definition_name": "somedefinition",
   *         "relation_or_permission_name": "somepermission"
   *       }
   *     }
   */
  ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION = "ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION",
  /**
   * ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST - The WriteRelationships request contained more updates than the maximum configured.
   *
   * Example of an ErrorInfo:
   *
   *     { "reason": "ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "update_count": "525",
   *         "maximum_updates_allowed": "500",
   *       }
   *     }
   */
  ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST = "ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST",
  /**
   * ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST - The request contained more preconditions than the maximum configured.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "precondition_count": "525",
   *         "maximum_preconditions_allowed": "500",
   *       }
   *     }
   */
  ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST = "ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST",
  /**
   * ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE - The request contained a precondition that failed.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "precondition_resource_type": "document",
   *         ... other fields for the filter ...
   *         "precondition_operation": "MUST_EXIST",
   *       }
   *     }
   */
  ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE = "ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE",
  /**
   * ERROR_REASON_SERVICE_READ_ONLY - A write or delete request was made to an instance that is deployed in read-only mode.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_SERVICE_READ_ONLY",
   *       "domain": "authzed.com"
   *     }
   */
  ERROR_REASON_SERVICE_READ_ONLY = "ERROR_REASON_SERVICE_READ_ONLY",
  /**
   * ERROR_REASON_UNKNOWN_CAVEAT - The request referenced an unknown caveat in the schema.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_UNKNOWN_CAVEAT",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "caveat_name": "somecaveat"
   *       }
   *     }
   */
  ERROR_REASON_UNKNOWN_CAVEAT = "ERROR_REASON_UNKNOWN_CAVEAT",
  /**
   * ERROR_REASON_INVALID_SUBJECT_TYPE - The request tries to use a subject type that was not valid for a relation.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_INVALID_SUBJECT_TYPE",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "definition_name": "somedefinition",
   *         "relation_name": "somerelation",
   *         "subject_type": "user:*"
   *       }
   *     }
   */
  ERROR_REASON_INVALID_SUBJECT_TYPE = "ERROR_REASON_INVALID_SUBJECT_TYPE",
  /**
   * ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR - The request tries to specify a caveat parameter value with the wrong type.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "definition_name": "somedefinition",
   *         "relation_name": "somerelation",
   *         "caveat_name": "somecaveat",
   *         "parameter_name": "someparameter",
   *         "expected_type": "int",
   *       }
   *     }
   */
  ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR = "ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR",
  /**
   * ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP - The request tries to perform two or more updates on the same relationship in the same WriteRelationships call.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "definition_name": "somedefinition",
   *         "relationship": "somerelationship",
   *       }
   *     }
   */
  ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP = "ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP",
  /**
   * ERROR_REASON_CANNOT_UPDATE_PERMISSION - The request tries to write a relationship on a permission instead of a relation.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_CANNOT_UPDATE_PERMISSION",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "definition_name": "somedefinition",
   *         "permission_name": "somerelation",
   *       }
   *     }
   */
  ERROR_REASON_CANNOT_UPDATE_PERMISSION = "ERROR_REASON_CANNOT_UPDATE_PERMISSION",
  /**
   * ERROR_REASON_CAVEAT_EVALUATION_ERROR - The request failed to evaluate a caveat expression due to an error.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_CAVEAT_EVALUATION_ERROR",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "caveat_name": "somecaveat",
   *       }
   *     }
   */
  ERROR_REASON_CAVEAT_EVALUATION_ERROR = "ERROR_REASON_CAVEAT_EVALUATION_ERROR",
  /**
   * ERROR_REASON_INVALID_CURSOR - The request failed because the provided cursor was invalid in some way.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_INVALID_CURSOR",
   *       "domain": "authzed.com",
   *       "metadata": {
   *          ... additional keys based on the kind of cursor error ...
   *       }
   *     }
   */
  ERROR_REASON_INVALID_CURSOR = "ERROR_REASON_INVALID_CURSOR",
  /**
   * ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE - The request failed because there are too many matching relationships to be
   * deleted within a single transactional deletion call. To avoid, set
   * `optional_allow_partial_deletions` to true on the DeleteRelationships call.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE",
   *       "domain": "authzed.com",
   *       "metadata": {
   *          ... fields for the filter ...
   *       }
   *     }
   */
  ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE =
    "ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE",
  /**
   * ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE - The request failed because the client attempted to write a relationship
   * with a context that exceeded the configured server limit.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "relationship":     "relationship_exceeding_the_limit",
   *         "max_allowed_size": "server_max_allowed_context_size",
   *         "context_size":     "actual_relationship_context_size" ,
   *       }
   *     }
   */
  ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE = "ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE",
  /**
   * ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP - The request failed because a relationship marked to be CREATEd
   * was already present within the datastore.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "relationship":          "relationship_that_already_existed",
   *         "resource_type":         "resource type",
   *         "resource_object_id":    "resource object id",
   *         ... additional decomposed relationship fields ...
   *       }
   *     }
   */
  ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP = "ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP",
  /**
   * ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED - The request failed because it caused the maximum depth allowed to be
   * exceeded. This typically indicates that there is a circular data traversal
   * somewhere in the schema, but can also be raised if the data traversal is simply
   * too deep.
   *
   * Example of an ErrorInfo:
   *
   *     {
   *       "reason": "ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED",
   *       "domain": "authzed.com",
   *       "metadata": {
   *         "maximum_depth_allowed": "50",
   *         ... additional fields based on request type ...
   *       }
   *     }
   */
  ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED = "ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function errorReasonFromJSON(object: any): ErrorReason {
  switch (object) {
    case 0:
    case "ERROR_REASON_UNSPECIFIED":
      return ErrorReason.ERROR_REASON_UNSPECIFIED;
    case 1:
    case "ERROR_REASON_SCHEMA_PARSE_ERROR":
      return ErrorReason.ERROR_REASON_SCHEMA_PARSE_ERROR;
    case 2:
    case "ERROR_REASON_SCHEMA_TYPE_ERROR":
      return ErrorReason.ERROR_REASON_SCHEMA_TYPE_ERROR;
    case 3:
    case "ERROR_REASON_UNKNOWN_DEFINITION":
      return ErrorReason.ERROR_REASON_UNKNOWN_DEFINITION;
    case 4:
    case "ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION":
      return ErrorReason.ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION;
    case 5:
    case "ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST":
      return ErrorReason.ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST;
    case 6:
    case "ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST":
      return ErrorReason.ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST;
    case 7:
    case "ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE":
      return ErrorReason.ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE;
    case 8:
    case "ERROR_REASON_SERVICE_READ_ONLY":
      return ErrorReason.ERROR_REASON_SERVICE_READ_ONLY;
    case 9:
    case "ERROR_REASON_UNKNOWN_CAVEAT":
      return ErrorReason.ERROR_REASON_UNKNOWN_CAVEAT;
    case 10:
    case "ERROR_REASON_INVALID_SUBJECT_TYPE":
      return ErrorReason.ERROR_REASON_INVALID_SUBJECT_TYPE;
    case 11:
    case "ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR":
      return ErrorReason.ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR;
    case 12:
    case "ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP":
      return ErrorReason.ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP;
    case 13:
    case "ERROR_REASON_CANNOT_UPDATE_PERMISSION":
      return ErrorReason.ERROR_REASON_CANNOT_UPDATE_PERMISSION;
    case 14:
    case "ERROR_REASON_CAVEAT_EVALUATION_ERROR":
      return ErrorReason.ERROR_REASON_CAVEAT_EVALUATION_ERROR;
    case 15:
    case "ERROR_REASON_INVALID_CURSOR":
      return ErrorReason.ERROR_REASON_INVALID_CURSOR;
    case 16:
    case "ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE":
      return ErrorReason.ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE;
    case 17:
    case "ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE":
      return ErrorReason.ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE;
    case 18:
    case "ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP":
      return ErrorReason.ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP;
    case 19:
    case "ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED":
      return ErrorReason.ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ErrorReason.UNRECOGNIZED;
  }
}

export function errorReasonToJSON(object: ErrorReason): string {
  switch (object) {
    case ErrorReason.ERROR_REASON_UNSPECIFIED:
      return "ERROR_REASON_UNSPECIFIED";
    case ErrorReason.ERROR_REASON_SCHEMA_PARSE_ERROR:
      return "ERROR_REASON_SCHEMA_PARSE_ERROR";
    case ErrorReason.ERROR_REASON_SCHEMA_TYPE_ERROR:
      return "ERROR_REASON_SCHEMA_TYPE_ERROR";
    case ErrorReason.ERROR_REASON_UNKNOWN_DEFINITION:
      return "ERROR_REASON_UNKNOWN_DEFINITION";
    case ErrorReason.ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION:
      return "ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION";
    case ErrorReason.ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST:
      return "ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST";
    case ErrorReason.ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST:
      return "ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST";
    case ErrorReason.ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE:
      return "ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE";
    case ErrorReason.ERROR_REASON_SERVICE_READ_ONLY:
      return "ERROR_REASON_SERVICE_READ_ONLY";
    case ErrorReason.ERROR_REASON_UNKNOWN_CAVEAT:
      return "ERROR_REASON_UNKNOWN_CAVEAT";
    case ErrorReason.ERROR_REASON_INVALID_SUBJECT_TYPE:
      return "ERROR_REASON_INVALID_SUBJECT_TYPE";
    case ErrorReason.ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR:
      return "ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR";
    case ErrorReason.ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP:
      return "ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP";
    case ErrorReason.ERROR_REASON_CANNOT_UPDATE_PERMISSION:
      return "ERROR_REASON_CANNOT_UPDATE_PERMISSION";
    case ErrorReason.ERROR_REASON_CAVEAT_EVALUATION_ERROR:
      return "ERROR_REASON_CAVEAT_EVALUATION_ERROR";
    case ErrorReason.ERROR_REASON_INVALID_CURSOR:
      return "ERROR_REASON_INVALID_CURSOR";
    case ErrorReason.ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE:
      return "ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE";
    case ErrorReason.ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE:
      return "ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE";
    case ErrorReason.ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP:
      return "ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP";
    case ErrorReason.ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED:
      return "ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED";
    case ErrorReason.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function errorReasonToNumber(object: ErrorReason): number {
  switch (object) {
    case ErrorReason.ERROR_REASON_UNSPECIFIED:
      return 0;
    case ErrorReason.ERROR_REASON_SCHEMA_PARSE_ERROR:
      return 1;
    case ErrorReason.ERROR_REASON_SCHEMA_TYPE_ERROR:
      return 2;
    case ErrorReason.ERROR_REASON_UNKNOWN_DEFINITION:
      return 3;
    case ErrorReason.ERROR_REASON_UNKNOWN_RELATION_OR_PERMISSION:
      return 4;
    case ErrorReason.ERROR_REASON_TOO_MANY_UPDATES_IN_REQUEST:
      return 5;
    case ErrorReason.ERROR_REASON_TOO_MANY_PRECONDITIONS_IN_REQUEST:
      return 6;
    case ErrorReason.ERROR_REASON_WRITE_OR_DELETE_PRECONDITION_FAILURE:
      return 7;
    case ErrorReason.ERROR_REASON_SERVICE_READ_ONLY:
      return 8;
    case ErrorReason.ERROR_REASON_UNKNOWN_CAVEAT:
      return 9;
    case ErrorReason.ERROR_REASON_INVALID_SUBJECT_TYPE:
      return 10;
    case ErrorReason.ERROR_REASON_CAVEAT_PARAMETER_TYPE_ERROR:
      return 11;
    case ErrorReason.ERROR_REASON_UPDATES_ON_SAME_RELATIONSHIP:
      return 12;
    case ErrorReason.ERROR_REASON_CANNOT_UPDATE_PERMISSION:
      return 13;
    case ErrorReason.ERROR_REASON_CAVEAT_EVALUATION_ERROR:
      return 14;
    case ErrorReason.ERROR_REASON_INVALID_CURSOR:
      return 15;
    case ErrorReason.ERROR_REASON_TOO_MANY_RELATIONSHIPS_FOR_TRANSACTIONAL_DELETE:
      return 16;
    case ErrorReason.ERROR_REASON_MAX_RELATIONSHIP_CONTEXT_SIZE:
      return 17;
    case ErrorReason.ERROR_REASON_ATTEMPT_TO_RECREATE_RELATIONSHIP:
      return 18;
    case ErrorReason.ERROR_REASON_MAXIMUM_DEPTH_EXCEEDED:
      return 19;
    case ErrorReason.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface DataLoaderOptions {
  cache?: boolean;
}

export interface DataLoaders {
  rpcDataLoaderOptions?: DataLoaderOptions;
  getDataLoader<T>(identifier: string, constructorFn: () => T): T;
}
