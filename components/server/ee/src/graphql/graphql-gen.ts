/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { GraphQLResolveInfo } from 'graphql';
import * as protocol from '@gitpod/gitpod-protocol';
import { Context } from './graphql-controller';
export type Maybe<T> = T | undefined;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = { [X in Exclude<keyof T, K>]?: T[X] } & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

/** An object with a Globally Unique ID */
export type Node = {
  /** The ID of the object. */
  id: Scalars['ID'];
};

export enum Order_Dir {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type Query = {
   __typename?: 'Query';
  me: protocol.User;
  /**  Get user by ID  */
  user?: Maybe<protocol.User>;
  /**  Get users  */
  users?: Maybe<UserPaginationResult>;
  /**  Get the number of users  */
  userCount: Scalars['Int'];
  /**  Get workspaces  */
  workspaces?: Maybe<WorkspacePaginationResult>;
  /**  Get workspace instances  */
  workspaceInstances?: Maybe<WorkspaceInstancePaginationResult>;
};


export type QueryUserArgs = {
  userId: Scalars['ID'];
};


export type QueryUsersArgs = {
  offset?: Scalars['Int'];
  limit?: Scalars['Int'];
  orderBy?: User_Order_Keys;
  orderDir?: Order_Dir;
  searchTerm?: Maybe<Scalars['String']>;
  minCreationDate?: Maybe<Scalars['String']>;
  maxCreationDate?: Maybe<Scalars['String']>;
};


export type QueryWorkspacesArgs = {
  offset?: Scalars['Int'];
  limit?: Scalars['Int'];
  orderBy?: Workspace_Order_Keys;
  orderDir?: Order_Dir;
  ownerId?: Maybe<Scalars['String']>;
  searchTerm?: Maybe<Scalars['String']>;
  minCreationTime?: Maybe<Scalars['String']>;
  maxCreationTime?: Maybe<Scalars['String']>;
  type?: Maybe<Workspace_Type>;
};


export type QueryWorkspaceInstancesArgs = {
  offset?: Scalars['Int'];
  limit?: Scalars['Int'];
  orderBy?: Workspace_Instance_Order_Keys;
  orderDir?: Order_Dir;
  ownerId?: Maybe<Scalars['String']>;
  minCreationTime?: Maybe<Scalars['String']>;
  maxCreationTime?: Maybe<Scalars['String']>;
  onlyRunning?: Scalars['Boolean'];
  type?: Maybe<Workspace_Type>;
};

export type User = Node & {
   __typename?: 'User';
  id: Scalars['ID'];
  creationDate: Scalars['String'];
  avatarUrl?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  fullName?: Maybe<Scalars['String']>;
  displayName?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['String']>;
  blocked?: Maybe<Scalars['Boolean']>;
  deleted?: Maybe<Scalars['Boolean']>;
  workspaces: Array<protocol.Workspace>;
};

export enum User_Order_Keys {
  Id = 'id',
  CreationDate = 'creationDate'
}

export type UserPaginationResult = {
   __typename?: 'UserPaginationResult';
  total: Scalars['Int'];
  hasMore: Scalars['Boolean'];
  items: Array<protocol.User>;
};

export type Workspace = Node & {
   __typename?: 'Workspace';
  /**  Unique ID of this workspace  */
  id: Scalars['ID'];
  /**  Date/Time the workspace has been created  */
  creationTime: Scalars['String'];
  /**  The context URL of the workspace  */
  contextURL: Scalars['String'];
  /**  A description string  */
  description: Scalars['String'];
  /**  User that owns this workspace  */
  owner: protocol.User;
  /**  Workspace type  */
  type: Workspace_Type;
  /**  Instances (sessions) of this workspace  */
  instances: Array<protocol.WorkspaceInstance>;
};

export enum Workspace_Instance_Order_Keys {
  Id = 'id',
  CreationTime = 'creationTime'
}

export enum Workspace_Order_Keys {
  Id = 'id',
  CreationTime = 'creationTime'
}

export enum Workspace_Type {
  Regular = 'regular',
  Prebuild = 'prebuild',
  Probe = 'probe'
}

/**  WorkspaceInstance describes a part of a workspace's lifetime, specifically a single running session of it  */
export type WorkspaceInstance = Node & {
   __typename?: 'WorkspaceInstance';
  /**  ID is the unique identifier of this instance  */
  id: Scalars['ID'];
  /** the workspace this is an instance of */
  workspace?: Maybe<protocol.Workspace>;
  /** The time an instance has been created in the backend (before DB!) */
  creationTime: Scalars['String'];
  /** The time an instance has switched phase to 'Pending' */
  deployedTime?: Maybe<Scalars['String']>;
  /** The time an instance has switched phase to 'Running' */
  startedTime?: Maybe<Scalars['String']>;
  /** The time an instance has switched phase to 'Stopped' */
  stoppedTime?: Maybe<Scalars['String']>;
  /** ideUrl is the URL at which the workspace is available on the internet */
  ideUrl: Scalars['String'];
  /** region is the name of the workspace cluster this instance runs in */
  region: Scalars['String'];
  /** workspaceImage is the name of the Docker image this instance runs */
  workspaceImage: Scalars['String'];
  /** status is the latest status of the instance that we're aware of */
  status: WorkspaceInstanceStatus;
  /** instance is hard-deleted on the database and about to be collected by db-sync */
  deleted?: Maybe<Scalars['Boolean']>;
};

export type WorkspaceInstanceConditions = {
   __typename?: 'WorkspaceInstanceConditions';
  /**  Failed contains the reason the workspace failed to operate. If this field is empty, the workspace has not failed.  */
  failed?: Maybe<Scalars['String']>;
  /**  timeout contains the reason the workspace has timed out. If this field is empty, the workspace has not timed out.  */
  timeout?: Maybe<Scalars['String']>;
  /**
   *  PullingImages marks if the workspace is currently pulling its images. This
   * condition can only be set during PhaseCreating
   */
  pullingImages?: Maybe<Scalars['Boolean']>;
  /**  deployed marks that a workspace instance was sent/deployed at a workspace manager  */
  deployed?: Maybe<Scalars['Boolean']>;
  /**  Whether the workspace start triggered an image build  */
  neededImageBuild?: Maybe<Scalars['Boolean']>;
  /**  ISO8601 timestamp when the first user activity was registered in the frontend. Only set if the workspace is running.  */
  firstUserActivity?: Maybe<Scalars['String']>;
};

export type WorkspaceInstancePaginationResult = {
   __typename?: 'WorkspaceInstancePaginationResult';
  total: Scalars['Int'];
  hasMore: Scalars['Boolean'];
  items: Array<protocol.WorkspaceInstance>;
};

export type WorkspaceInstanceStatus = {
   __typename?: 'WorkspaceInstanceStatus';
  phase: Scalars['String'];
  conditions: WorkspaceInstanceConditions;
};

export type WorkspacePaginationResult = {
   __typename?: 'WorkspacePaginationResult';
  total: Scalars['Int'];
  hasMore: Scalars['Boolean'];
  items: Array<protocol.Workspace>;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type StitchingResolver<TResult, TParent, TContext, TArgs> = {
  fragment: string;
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};

export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | StitchingResolver<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterator<TResult> | Promise<AsyncIterator<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type isTypeOfResolverFn<T = {}> = (obj: T, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Query: ResolverTypeWrapper<{}>,
  User: ResolverTypeWrapper<protocol.User>,
  Node: ResolversTypes['User'] | ResolversTypes['Workspace'] | ResolversTypes['WorkspaceInstance'],
  ID: ResolverTypeWrapper<Scalars['ID']>,
  String: ResolverTypeWrapper<Scalars['String']>,
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>,
  Workspace: ResolverTypeWrapper<protocol.Workspace>,
  WORKSPACE_TYPE: Workspace_Type,
  WorkspaceInstance: ResolverTypeWrapper<protocol.WorkspaceInstance>,
  WorkspaceInstanceStatus: ResolverTypeWrapper<WorkspaceInstanceStatus>,
  WorkspaceInstanceConditions: ResolverTypeWrapper<WorkspaceInstanceConditions>,
  Int: ResolverTypeWrapper<Scalars['Int']>,
  USER_ORDER_KEYS: User_Order_Keys,
  ORDER_DIR: Order_Dir,
  UserPaginationResult: ResolverTypeWrapper<Omit<UserPaginationResult, 'items'> & { items: Array<ResolversTypes['User']> }>,
  WORKSPACE_ORDER_KEYS: Workspace_Order_Keys,
  WorkspacePaginationResult: ResolverTypeWrapper<Omit<WorkspacePaginationResult, 'items'> & { items: Array<ResolversTypes['Workspace']> }>,
  WORKSPACE_INSTANCE_ORDER_KEYS: Workspace_Instance_Order_Keys,
  WorkspaceInstancePaginationResult: ResolverTypeWrapper<Omit<WorkspaceInstancePaginationResult, 'items'> & { items: Array<ResolversTypes['WorkspaceInstance']> }>,
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Query: {},
  User: protocol.User,
  Node: ResolversParentTypes['User'] | ResolversParentTypes['Workspace'] | ResolversParentTypes['WorkspaceInstance'],
  ID: Scalars['ID'],
  String: Scalars['String'],
  Boolean: Scalars['Boolean'],
  Workspace: protocol.Workspace,
  WORKSPACE_TYPE: Workspace_Type,
  WorkspaceInstance: protocol.WorkspaceInstance,
  WorkspaceInstanceStatus: WorkspaceInstanceStatus,
  WorkspaceInstanceConditions: WorkspaceInstanceConditions,
  Int: Scalars['Int'],
  USER_ORDER_KEYS: User_Order_Keys,
  ORDER_DIR: Order_Dir,
  UserPaginationResult: Omit<UserPaginationResult, 'items'> & { items: Array<ResolversParentTypes['User']> },
  WORKSPACE_ORDER_KEYS: Workspace_Order_Keys,
  WorkspacePaginationResult: Omit<WorkspacePaginationResult, 'items'> & { items: Array<ResolversParentTypes['Workspace']> },
  WORKSPACE_INSTANCE_ORDER_KEYS: Workspace_Instance_Order_Keys,
  WorkspaceInstancePaginationResult: Omit<WorkspaceInstancePaginationResult, 'items'> & { items: Array<ResolversParentTypes['WorkspaceInstance']> },
}>;

export type NodeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Node'] = ResolversParentTypes['Node']> = ResolversObject<{
  __resolveType: TypeResolveFn<'User' | 'Workspace' | 'WorkspaceInstance', ParentType, ContextType>,
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>,
}>;

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  me?: Resolver<ResolversTypes['User'], ParentType, ContextType>,
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'userId'>>,
  users?: Resolver<Maybe<ResolversTypes['UserPaginationResult']>, ParentType, ContextType, RequireFields<QueryUsersArgs, 'offset' | 'limit' | 'orderBy' | 'orderDir'>>,
  userCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>,
  workspaces?: Resolver<Maybe<ResolversTypes['WorkspacePaginationResult']>, ParentType, ContextType, RequireFields<QueryWorkspacesArgs, 'offset' | 'limit' | 'orderBy' | 'orderDir'>>,
  workspaceInstances?: Resolver<Maybe<ResolversTypes['WorkspaceInstancePaginationResult']>, ParentType, ContextType, RequireFields<QueryWorkspaceInstancesArgs, 'offset' | 'limit' | 'orderBy' | 'orderDir' | 'onlyRunning'>>,
}>;

export type UserResolvers<ContextType = Context, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>,
  creationDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  fullName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  displayName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  blocked?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>,
  deleted?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>,
  workspaces?: Resolver<Array<ResolversTypes['Workspace']>, ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type UserPaginationResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['UserPaginationResult'] = ResolversParentTypes['UserPaginationResult']> = ResolversObject<{
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>,
  hasMore?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>,
  items?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type WorkspaceResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Workspace'] = ResolversParentTypes['Workspace']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>,
  creationTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  contextURL?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  owner?: Resolver<ResolversTypes['User'], ParentType, ContextType>,
  type?: Resolver<ResolversTypes['WORKSPACE_TYPE'], ParentType, ContextType>,
  instances?: Resolver<Array<ResolversTypes['WorkspaceInstance']>, ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type WorkspaceInstanceResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WorkspaceInstance'] = ResolversParentTypes['WorkspaceInstance']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>,
  workspace?: Resolver<Maybe<ResolversTypes['Workspace']>, ParentType, ContextType>,
  creationTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  deployedTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  startedTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  stoppedTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  ideUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  region?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  workspaceImage?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  status?: Resolver<ResolversTypes['WorkspaceInstanceStatus'], ParentType, ContextType>,
  deleted?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type WorkspaceInstanceConditionsResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WorkspaceInstanceConditions'] = ResolversParentTypes['WorkspaceInstanceConditions']> = ResolversObject<{
  failed?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  timeout?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  pullingImages?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>,
  deployed?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>,
  neededImageBuild?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>,
  firstUserActivity?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type WorkspaceInstancePaginationResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WorkspaceInstancePaginationResult'] = ResolversParentTypes['WorkspaceInstancePaginationResult']> = ResolversObject<{
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>,
  hasMore?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>,
  items?: Resolver<Array<ResolversTypes['WorkspaceInstance']>, ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type WorkspaceInstanceStatusResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WorkspaceInstanceStatus'] = ResolversParentTypes['WorkspaceInstanceStatus']> = ResolversObject<{
  phase?: Resolver<ResolversTypes['String'], ParentType, ContextType>,
  conditions?: Resolver<ResolversTypes['WorkspaceInstanceConditions'], ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type WorkspacePaginationResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WorkspacePaginationResult'] = ResolversParentTypes['WorkspacePaginationResult']> = ResolversObject<{
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>,
  hasMore?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>,
  items?: Resolver<Array<ResolversTypes['Workspace']>, ParentType, ContextType>,
  __isTypeOf?: isTypeOfResolverFn<ParentType>,
}>;

export type Resolvers<ContextType = Context> = ResolversObject<{
  Node?: NodeResolvers,
  Query?: QueryResolvers<ContextType>,
  User?: UserResolvers<ContextType>,
  UserPaginationResult?: UserPaginationResultResolvers<ContextType>,
  Workspace?: WorkspaceResolvers<ContextType>,
  WorkspaceInstance?: WorkspaceInstanceResolvers<ContextType>,
  WorkspaceInstanceConditions?: WorkspaceInstanceConditionsResolvers<ContextType>,
  WorkspaceInstancePaginationResult?: WorkspaceInstancePaginationResultResolvers<ContextType>,
  WorkspaceInstanceStatus?: WorkspaceInstanceStatusResolvers<ContextType>,
  WorkspacePaginationResult?: WorkspacePaginationResultResolvers<ContextType>,
}>;


/**
 * @deprecated
 * Use "Resolvers" root object instead. If you wish to get "IResolvers", add "typesPrefix: I" to your config.
*/
export type IResolvers<ContextType = Context> = Resolvers<ContextType>;
