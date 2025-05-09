# PDD: Maintenance Mode Toggle (Feature 4.3)

**Parent PRD:** [001-infra-rollout.md](../prd/001-infra-rollout.md)
**Tracking Issue:** [CLC-1273](https://linear.app/gitpod/issue/CLC-1273/admin-maintenance-mode-toggle)

## 1. Overview

This document outlines the technical design and implementation plan for the "Maintenance Mode Toggle" feature. This feature allows administrators to manually enable or disable a maintenance mode for their Gitpod organization/instance. When enabled, new workspace starts are prevented, a notification is shown on the dashboard, and the "Stop All Workspaces" button becomes active.

## 2. Requirements

As per PRD `001-infra-rollout.md` (Section 4.3):
*   **R2.1:** Administrators must be able to manually enable or disable a "Maintenance Mode".
*   **R2.2:** When Maintenance Mode is enabled:
    *   Users must be prevented from starting new workspaces (failure reason: "maintenanceMode").
    *   A clear warning/notification must be displayed on the dashboard.
    *   The "Stop All Running Workspaces" button must be enabled; otherwise, it must be disabled.
*   **R2.3:** The toggle allows control over the system state during updates.
*   The `maintenanceMode` flag should be stored in the `DBTeam` (Organization) table.
*   The UI toggle should be in a new section on the Admin page, above "running workspaces".

## 3. Technical Design & Implementation Plan

### I. Backend Changes (Server & Database)

#### 1. Database Schema Update (`gitpod-db`)
*   **Target Entity:** `DBTeam` (in `components/gitpod-db/src/typeorm/entity/db-team.ts`).
    *   This table represents an "Organization".
*   **Action:** Add a new column `maintenanceMode` to the `DBTeam` entity.
    *   Type: `boolean`
    *   Default Value: `false`
*   **Migration:** A TypeORM migration script will be generated and applied to add this column.

#### 2. Permissions Definition (SpiceDB)
*   **Target File:** `components/spicedb/schema/schema.yaml`
*   **Action:** In the `definition organization` block, add a new permission:
    ```yaml
    permission maintenance = owner + installation->admin
    ```
*   This grants the `maintenance` permission to users who are an `owner` of the organization or an `admin` of the installation.
*   The SpiceDB schema will be updated and reloaded/re-validated.

#### 3. API Definition (gRPC - Public API)
*   **Target File:** `components/public-api/gitpod/v1/organization.proto`
*   **Action:** Add new RPC methods to the `OrganizationService`:
    ```protobuf
    service OrganizationService {
      // ... existing RPCs ...

      // GetOrganizationMaintenanceMode retrieves the maintenance mode status for an organization.
      rpc GetOrganizationMaintenanceMode(GetOrganizationMaintenanceModeRequest) returns (GetOrganizationMaintenanceModeResponse) {}

      // SetOrganizationMaintenanceMode sets the maintenance mode status for an organization.
      rpc SetOrganizationMaintenanceMode(SetOrganizationMaintenanceModeRequest) returns (SetOrganizationMaintenanceModeResponse) {}
    }

    message GetOrganizationMaintenanceModeRequest {
      string organization_id = 1; // ID of the DBTeam
    }

    message GetOrganizationMaintenanceModeResponse {
      bool enabled = 1;
    }

    message SetOrganizationMaintenanceModeRequest {
      string organization_id = 1; // ID of the DBTeam
      bool enabled = 2;
    }

    message SetOrganizationMaintenanceModeResponse {
      bool enabled = 1; // The new state of maintenance mode
    }
    ```
*   Relevant code generation scripts (for Go, TypeScript clients/servers) will be run after this change.

#### 4. API Implementation (`server` component - TypeScript)
*   The `server` component will implement the server-side logic for the new `gitpod.v1.OrganizationService` RPCs.
*   This will involve updating or creating a service class (e.g., `OrganizationServiceImpl.ts` in `components/server/src/services/` or `components/server/src/orgs/`).
*   **`GetOrganizationMaintenanceMode` Implementation:**
    *   Input: `GetOrganizationMaintenanceModeRequest`.
    *   Authorization: Verify the caller has the `maintenance` permission on the `organization:{organization_id}` resource using SpiceDB.
    *   Logic: Fetch `DBTeam` by `organization_id` and return its `maintenanceMode` status.
*   **`SetOrganizationMaintenanceMode` Implementation:**
    *   Input: `SetOrganizationMaintenanceModeRequest`.
    *   Authorization: Verify `maintenance` permission on `organization:{organization_id}` via SpiceDB.
    *   Logic: Update `maintenanceMode` for the `DBTeam` and return the new status.
*   The `server` component directly hosts and implements the `gitpod.v1` gRPC services, so it will handle these incoming gRPC requests.

#### 5. Workspace Start Logic Modification
*   **Target File:** `components/server/src/workspace/workspace-starter.ts`
*   **Action:** In the `startWorkspace` method of the `WorkspaceStarter` class:
    *   After existing permission checks (e.g., `checkStartPermission`, `checkBlockedRepository`).
    *   Retrieve `organizationId` from the `workspace.organizationId` field.
    *   Fetch the `DBTeam` entity for this `organizationId` (potentially via `OrganizationService`).
    *   If `team?.maintenanceMode` is `true`:
        *   Prevent the workspace start.
        *   Throw an `ApplicationError` (e.g., with code `SERVICE_UNAVAILABLE` or a new custom code) with a user-friendly message like "Cannot start workspace: The system is currently in maintenance mode."
        *   Ensure the error includes the `failureReason: "maintenanceMode"`.

### II. Frontend Changes (Dashboard - `components/dashboard/`)

#### 1. API Client Service
*   Update or create methods in the dashboard's API client service to call the new gRPC endpoints (e.g., `getMaintenanceMode(orgId: string)`, `setMaintenanceMode(orgId: string, enabled: boolean)`). This might involve using a generated gRPC-web client or a RESTful wrapper if Connect is used.

#### 2. Admin Page - Maintenance Mode Section & Toggle
*   A new UI section will be added to the Admin page, positioned above the "Running Workspaces" card.
*   A new React component (e.g., `MaintenanceModeCard.tsx` in `components/dashboard/src/components/admin/`) will be created to:
    *   Fetch the current maintenance mode status for the organization using the API client.
    *   Display a toggle switch (e.g., from Material UI or a custom component) reflecting the current status.
    *   When the toggle is changed, call the `setMaintenanceMode` API endpoint.
    *   Provide user feedback (loading indicators, success/error messages).

#### 3. Global Dashboard Notification/Banner
*   Implement a global state management solution (e.g., React Context, Redux slice) to make the maintenance status available throughout the dashboard application.
*   Create a new banner component (e.g., `MaintenanceModeBanner.tsx`) that:
    *   Consumes the global maintenance status.
    *   If maintenance mode is active for the user's organization, displays a prominent, non-dismissible warning banner on relevant dashboard pages (e.g., dashboard home, workspace list, new workspace page).
    *   The banner text should clearly state: "System is in maintenance mode. Starting new workspaces is currently disabled."
*   Integrate this banner into the main application layout component.

#### 4. "Stop All Workspaces" Button Logic
*   The existing "Stop All Workspaces" button (implemented as part of feature 4.2, likely in a component like `RunningWorkspacesCard.tsx`) will be modified.
*   The button will be **enabled only if `maintenanceMode` is `true`** for the organization. Otherwise, it will be disabled.
*   This requires the component rendering the button to access the current maintenance mode status (from the global state or by fetching it).

### III. Permissions & Auditing (Backend - `components/server/`)

#### 1. Permissions Implementation
*   The gRPC method implementations in the `server` component will use the SpiceDB client to check if the authenticated user has the `maintenance` permission on the `organization:{orgId}` resource before allowing the `GetOrganizationMaintenanceMode` and `SetOrganizationMaintenanceMode` operations.

#### 2. Auditing (Consideration)
*   Actions related to enabling/disabling maintenance mode should be logged for auditing purposes. This could involve creating `DbAuditLog` entries.

## 4. Open Questions / Considerations
*   Exact naming and location of the new gRPC service implementation class within the `server` component.
*   Specific error code to use for `ApplicationError` when maintenance mode blocks workspace start.
*   Need to ensure that the `orgId` used by the frontend (dashboard) correctly corresponds to `DBTeam.id`.
