# SpiceDB Component

## Overview

The SpiceDB component in Gitpod provides authorization and permission management using the SpiceDB authorization system. It defines the relationship-based access control (ReBAC) schema that governs permissions across the Gitpod platform, enabling fine-grained access control for users, organizations, projects, workspaces, and other resources.

## Purpose

The primary purposes of the SpiceDB component are:
- Define the authorization schema for Gitpod
- Model relationships between entities (users, organizations, projects, workspaces)
- Specify permissions based on these relationships
- Provide a consistent authorization system across the platform
- Enable fine-grained access control
- Support complex permission scenarios
- Facilitate permission checks in other components
- Ensure secure access to resources

## Architecture

The SpiceDB component consists of:

1. **Schema Definition**: YAML-based schema that defines entities, relationships, and permissions
2. **Go Library**: Code for loading and managing the schema
3. **TypeScript Bindings**: Generated TypeScript code for frontend components
4. **Validation**: Tests and assertions to verify schema correctness
5. **Integration**: Connection to the SpiceDB service for permission checks

The component follows the SpiceDB authorization model, which is based on the Google Zanzibar paper. It uses a relationship-based approach where permissions are derived from relationships between entities.

## Key Entities and Relationships

### Entities
1. **User**: Individual users of the Gitpod platform
2. **Installation**: The global Gitpod installation
3. **Organization**: Groups of users with shared resources
4. **Project**: Repositories or codebases within an organization
5. **Workspace**: Development environments for projects

### Relationships
- **User-Installation**: Users can be members or admins of the installation
- **User-Organization**: Users can be members, owners, or collaborators of organizations
- **Organization-Installation**: Organizations belong to an installation
- **Project-Organization**: Projects belong to organizations
- **Project-User**: Users can be viewers or editors of projects
- **Workspace-Organization**: Workspaces belong to organizations
- **Workspace-User**: Users can own or share workspaces

## Permissions

The schema defines various permissions for each entity type:

### User Permissions
- `read_info`: View user information
- `write_info`: Edit user information
- `delete`: Delete user account
- `make_admin`: Make a user an admin
- `admin_control`: Administrative control over users
- `read_ssh`: View SSH keys
- `write_ssh`: Manage SSH keys
- `read_tokens`: View access tokens
- `write_tokens`: Manage access tokens
- `read_env_var`: View environment variables
- `write_env_var`: Manage environment variables
- `write_temporary_token`: Create temporary tokens
- `code_sync`: Synchronize code

### Organization Permissions
- `read_info`: View organization information
- `write_info`: Edit organization information
- `delete`: Delete organization
- `read_settings`: View organization settings
- `write_settings`: Edit organization settings
- `read_env_var`: View organization environment variables
- `write_env_var`: Manage organization environment variables
- `read_audit_logs`: View audit logs
- `read_members`: View organization members
- `invite_members`: Invite new members
- `write_members`: Manage organization members
- `leave`: Leave the organization
- `create_project`: Create new projects
- `read_git_provider`: View Git provider information
- `write_git_provider`: Manage Git provider settings
- `read_billing`: View billing information
- `write_billing`: Manage billing settings
- `read_prebuild`: View prebuilds
- `create_workspace`: Create workspaces
- `read_sessions`: View user sessions
- `write_billing_admin`: Administrative billing control

### Project Permissions
- `read_info`: View project information
- `write_info`: Edit project information
- `delete`: Delete project
- `read_env_var`: View project environment variables
- `write_env_var`: Manage project environment variables
- `read_prebuild`: View project prebuilds
- `write_prebuild`: Manage project prebuilds

### Workspace Permissions
- `access`: Access the workspace
- `start`: Start the workspace
- `stop`: Stop the workspace
- `delete`: Delete the workspace
- `read_info`: View workspace information
- `create_snapshot`: Create workspace snapshots
- `admin_control`: Administrative control over workspaces

## Configuration

The SpiceDB component is configured through a YAML schema file:

```yaml
schema/schema.yaml
```

This file defines:
- Entity types (user, organization, project, workspace)
- Relationships between entities
- Permissions derived from these relationships
- Validation rules and assertions for testing

## Integration Points

The SpiceDB component integrates with:
1. **Server**: For permission checks on API requests
2. **Dashboard**: For UI permission enforcement
3. **Public API**: For permission checks on API requests
4. **Workspace Manager**: For workspace access control
5. **SpiceDB Service**: The actual authorization service that evaluates permission checks

## Usage Patterns

### Permission Checking
```go
// Check if a user can access a workspace
allowed, err := client.CheckPermission(ctx, "workspace:workspace_1", "access", "user:user_1")
```

### Relationship Management
```go
// Add a user as a member of an organization
err := client.WriteRelationships(ctx, []spicedb.Relationship{
    {
        Resource: "organization:org_1",
        Relation: "member",
        Subject: "user:user_1",
    },
})
```

## Security Considerations

The component implements several security measures:

1. **Least Privilege**: Permissions follow the principle of least privilege
2. **Defense in Depth**: Multiple layers of permission checks
3. **Separation of Concerns**: Clear separation between different entity types
4. **Validation**: Schema validation to ensure correctness
5. **Assertions**: Tests to verify expected permission behavior

## Dependencies

### Internal Dependencies
None specified in the component's build configuration.

### External Dependencies
- SpiceDB service for authorization checks
- YAML parsing libraries
- Code generation tools

## Related Components

- **Server**: Uses SpiceDB for API permission checks
- **Dashboard**: Uses SpiceDB for UI permission enforcement
- **Public API**: Uses SpiceDB for API permission checks
- **Workspace Manager**: Uses SpiceDB for workspace access control
