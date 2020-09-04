export type Maybe<T> = T | undefined;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type Mutation = {
   __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']>;
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
  _empty?: Maybe<Scalars['String']>;
  me: User;
  /**  Get user by ID  */
  user?: Maybe<User>;
  /**  Get the number of users  */
  userCount: Scalars['Int'];
  /**  Get users  */
  users?: Maybe<UserPaginationResult>;
  /**  Get workspace instances  */
  workspaceInstances?: Maybe<WorkspaceInstancePaginationResult>;
  /**  Get workspaces  */
  workspaces?: Maybe<WorkspacePaginationResult>;
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

export type Subscription = {
   __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']>;
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
  workspaces: Array<Workspace>;
};

export enum User_Order_Keys {
  Id = 'id',
  CreationDate = 'creationDate'
}

export type UserPaginationResult = {
   __typename?: 'UserPaginationResult';
  total: Scalars['Int'];
  hasMore: Scalars['Boolean'];
  items: Array<User>;
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
  owner: User;
  /**  Workspace type  */
  type: Workspace_Type;
  /**  Instances (sessions) of this workspace  */
  instances: Array<WorkspaceInstance>;
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
  workspace?: Maybe<Workspace>;
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
  /**
   *  ServiceExists denotes if the workspace theia-/ports- services exist. This
   * condition will be true if either of the two services exist. 
   */
  serviceExists?: Maybe<Scalars['Boolean']>;
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
  items: Array<WorkspaceInstance>;
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
  items: Array<Workspace>;
};
