# PDD: Infrastructure Rollout - Task 4.2: Stop All Running Workspaces

- **Associated PRD**: [prd/001-infra-rollout.md](./001-infra-rollout.md) - Section 4.2
- **Date**: May 8, 2025
- **Author**: Cline
- **Version**: 1.0
- **Status**: Draft

## 1. Overview
This document outlines the design for implementing the "Stop All Running Workspaces" feature for administrators. This feature allows an administrator to initiate a stop command for all currently running workspaces within their organization. This implementation will leverage frontend orchestration, using existing APIs.

## 2. Background
As part of improving the infrastructure update rollout experience (PRD Ref: [CLC-1275](https://linear.app/gitpod/issue/CLC-1275/admin-stop-all-running-workspaces-button-for-infra-update)), administrators need a way to ensure all workspaces are safely stopped (and thus backed up) before an update. This feature provides that capability.

## 3. Proposed Design & Implementation

### 3.1. Approach: Frontend Orchestration
This feature will be implemented primarily in the frontend (`components/dashboard/`). The frontend will:
1.  Fetch the list of currently running/active workspaces.
2.  Upon admin confirmation, iterate through this list.
3.  For each workspace, call the existing public API `workspaceClient.stopWorkspace()` to request a graceful stop.

This approach is viable because the SpiceDB schema (`components/spicedb/schema/schema.yaml`) confirms that an organization owner (`org->owner`) has the `stop` permission on workspaces belonging to their organization, which is enforced by the backend's `WorkspaceService.stopWorkspace` method.

### 3.2. Affected Code Units (Frontend - `components/dashboard/`)

-   **`src/org-admin/AdminPage.tsx`**:
    *   This page already hosts the `RunningWorkspacesCard.tsx` (as per PDD `001-infra-rollout-4.1.md`). No direct changes are needed here for this specific feature, as the functionality will be encapsulated within `RunningWorkspacesCard.tsx`.
-   **`src/org-admin/RunningWorkspacesCard.tsx`**:
    *   This existing component (detailed in PDD `001-infra-rollout-4.1.md`) already fetches and displays running/active workspace sessions using the `useWorkspaceSessions` hook.
    *   It will be **enhanced** to include the "Stop All Running Workspaces" button and its associated logic.

### 3.3. Key Modifications to `RunningWorkspacesCard.tsx`

-   **New UI Elements:**
    *   **"Stop All Running Workspaces" Button:**
        *   To be placed prominently within the card (e.g., in the card header or a dedicated action row).
        *   Label: "Stop All Running Workspaces".
    *   **Confirmation Dialog:**
        *   A modal dialog will appear upon clicking the button.
        *   It will clearly explain the action (e.g., "This will attempt to stop all currently running workspaces in your organization. Workspaces are backed up before stopping. This action cannot be undone for the stop process itself.") and require explicit confirmation (e.g., "Confirm Stop All" button).

-   **New Logic:**
    1.  **Handle "Stop All" Action (on confirmed dialog):**
        *   The `useWorkspaceSessions` hook's data (`data.pages`) is already available within this component.
        *   Flatten the session pages: `const allSessions = data.pages.flatMap(page => page);`
        *   Filter for "not stopped" workspaces (this filtering logic may already exist for display purposes):
            ```typescript
            const notStoppedSessions = allSessions.filter(session =>
                session.workspace?.status?.phase?.name !== WorkspacePhase_Phase.STOPPED
            );
            ```
        *   Iterate through `notStoppedSessions`. For each `session` where `session.workspace?.id` is valid:
            *   Call `workspaceClient.stopWorkspace({ workspaceId: session.workspace.id })`.
                *   The `workspaceClient` is imported from `../../service/public-api` (as seen in `list-workspace-sessions-query.ts`).
            *   Handle individual API call responses:
                *   Track successes and failures.
                *   Update the UI to provide feedback (e.g., a progress indicator, a list of workspaces being processed, or a summary toast/notification).
        *   Provide overall feedback to the administrator (e.g., "Stop command sent for X workspaces. Successes: Y, Failures: Z.").
        *   The list of running workspaces displayed by this card should update automatically as `useWorkspaceSessions` refetches or its cache is updated by `react-query` after the stop actions. A manual refetch can also be triggered if necessary.

### 3.4. Backend Interaction (`components/server/`)
-   **No new dedicated backend API endpoint** is required for the "stop-all" action itself.
-   The frontend will use the existing `workspaceClient.stopWorkspace()` method, which calls the public `StopWorkspace` RPC.
-   The backend's `WorkspaceService.stopWorkspace` method, along with the `Authorizer` and SpiceDB schema, already handles the necessary permission checks to ensure an organization owner can stop workspaces within their organization.
-   The interlock with Maintenance Mode (i.e., disabling this button if Maintenance Mode is not active) will be handled as part of Feature 4.3's implementation.

### 3.5. Diagram of "Stop All" Flow

```mermaid
graph TD
    Admin[Admin User] -- Clicks --> Btn["Stop All Workspaces Button (in RunningWorkspacesCard)"]
    Admin -- Confirms --> ConfirmDlg["Confirmation Dialog"]
    ConfirmDlg -- Triggers --> Iterate[Iterate Filtered Workspaces (from useWorkspaceSessions)]
    Iterate -- For Each Workspace --> CallAPI["Call workspaceClient.stopWorkspace({workspaceId})"]
    CallAPI -- Interacts With --> BackendAPI["Existing Public StopWorkspace RPC (Server)"]
    BackendAPI -- Checks Permissions --> SpiceDB[(SpiceDB: org_owner can stop)]
    BackendAPI -- Executes Stop --> WSStop[Workspace Stop Logic (ws-manager, etc.)]
    CallAPI -- Updates --> UIFeedback[UI Feedback (Progress, Success/Failure)]
    WSStop -- Eventually Updates --> WSList[Running Workspaces List (Refreshed)]
```

## 4. Advantages of this Approach
-   **Reduced Backend Complexity:** No need to design, implement, and test a new backend API endpoint specifically for stopping all workspaces.
-   **Leverages Existing Infrastructure:** Utilizes the existing, tested `StopWorkspace` public API and its permission model.
-   **Clear Permission Model:** Relies on the confirmed SpiceDB definition where organization owners can stop workspaces in their org.

## 5. Testing Strategy
-   **Manual Testing:**
    *   Verify the "Stop All Running Workspaces" button is present in the `RunningWorkspacesCard`.
    *   Verify clicking the button shows a confirmation dialog with appropriate explanatory text.
    *   Verify that confirming the dialog triggers calls to `workspaceClient.stopWorkspace()` for all displayed "not stopped" workspaces.
    *   Verify appropriate UI feedback during and after the stop operations (e.g., progress, success/error messages for individual stops or overall).
    *   Verify the list of running workspaces in `RunningWorkspacesCard` updates correctly after workspaces are stopped.
    *   Test with various scenarios: no running workspaces, a few running workspaces, many running workspaces (if feasible in a test environment).
    *   Test error handling if individual `stopWorkspace` calls fail.

## 6. Rollout Plan
-   This enhancement to `RunningWorkspacesCard.tsx` will be part of a standard `components/dashboard/` component update, released alongside the other "Infrastructure Rollout" features.

## 7. Open Questions & Risks
-   **UI Feedback for Batch Operation:** Resolved. Assumed stopping will be quick. A toast notification will be shown once `stopWorkspace` has been called on all targeted workspaces.
-   **Rate Limiting/Concurrency:** Resolved. Considered not a problem at this time.
-   **Dependency on Maintenance Mode API:** The requirement for this button to be disabled if Maintenance Mode is not active (R3.4 in the main PRD) has been moved to be implemented as part of Feature 4.3 (Maintenance Mode Toggle). This PDD assumes the button is always enabled for an admin, and the interlock will be added later.

## 8. Future Considerations
-   If performance issues arise with stopping a very large number of workspaces via individual frontend calls, a backend batch operation could be reconsidered in the future, but the current approach is preferred for its simplicity.
