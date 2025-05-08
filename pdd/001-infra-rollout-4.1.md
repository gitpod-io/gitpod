# PDD: Infrastructure Rollout - Task 4.1: View Running Workspaces

**PRD Reference:** [prd/001-infra-rollout.md](../prd/001-infra-rollout.md) - Section 4.1

**Objective:** Implement the "View Running Workspaces" feature for administrators as part of the improved infrastructure update rollout experience. This will be a frontend-only implementation, reusing existing data sources and components, and filtering data on the client-side.

## Plan Details (Frontend Only)

### 1. Admin Page Structure
*   **Location:** `components/dashboard/src/org-admin/OrgAdminPage.tsx`. (This page is assumed to exist or will be created as per the main PRD's "Admin Page Scaffolding" task).
*   **Content:** This page will host a main section titled "Infrastructure Rollout", under which the new card for viewing running workspaces will be placed.

### 2. `RunningWorkspacesCard.tsx` Component
*   **New File Location:** `components/dashboard/src/org-admin/RunningWorkspacesCard.tsx`.
*   **Purpose:** This component will fetch usage data for a recent period using the existing `useListUsage` hook and then filter this data on the client-side to display only currently running workspaces.
*   **Visual Style:**
    *   The component will be rendered as a "card" with a title, e.g., "Currently Running Workspaces".
    *   Styling will be done using Tailwind CSS to match the application's existing card style (e.g., `className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4"`).
*   **Data Fetching & Filtering:**
*   **Hook:** Use `useWorkspaceSessions` from `components/dashboard/src/data/insights/list-workspace-sessions-query.ts`.
*   **Parameters for `useWorkspaceSessions`:**
    *   The hook implicitly uses the `organizationId` from `useCurrentOrg()`.
    *   The `from` parameter is set to 48 hours in the past: `from: Timestamp.fromDate(dayjs().subtract(48, 'hours').startOf('day').toDate())`.
    *   The `to` parameter is omitted (implying up to the present).
*   The `useWorkspaceSessions` hook (which uses `useInfiniteQuery`) will manage loading (`isLoading`, `isFetchingNextPage`), error (`isError`, `error`), and pagination (`fetchNextPage`, `hasNextPage`) states. All pages will be fetched automatically.
*   **Frontend Filtering Logic:**
    *   Once `data.pages` (from `useWorkspaceSessions` result) is fetched and flattened into `allSessions`, filter this array using a function like `isWorkspaceNotStopped`.
    *   A workspace session is considered "not stopped" (and thus relevant for admin view during maintenance) if `session.workspace?.status?.phase?.name !== WorkspacePhase_Phase.STOPPED`. This includes running, pending, creating, initializing, stopping, etc.
    *   The result will be an array of `WorkspaceSession` objects.
*   **Display Logic (within `RunningWorkspacesCard.tsx`):**
    *   Iterate over the filtered list of `WorkspaceSession` objects.
    *   **Information to Display per Workspace (from `WorkspaceSession` object and its nested properties), in order:**
        *   Status: Rendered using `<WorkspaceStatusIndicator status={session.workspace?.status} />`.
        *   Workspace ID: `session.workspace?.id`.
        *   User: `session.owner?.name`.
        *   Project: `session.context?.repository?.cloneUrl` or `session.workspace?.metadata?.originalContextUrl` (formatted using `toRemoteURL` if applicable).
        *   Start Time: `session.startedTime` (a `google.protobuf.Timestamp`, converted to `Date` then formatted using `displayTime` function from `UsageEntry.tsx`).
    *   The list structure will use `ItemsList`, `Item`, and `ItemField` components from `components/dashboard/src/components/ItemsList.tsx`.
    *   If the filtered list is empty, display: "No workspaces are currently running."
*   **Integration:**
    *   Import and render `RunningWorkspacesCard.tsx` within the "Infrastructure Rollout" section of `OrgAdminPage.tsx`.

### 3. Diagram of Frontend Component Interaction

```mermaid
graph TD
    A[OrgAdminPage.tsx] -- Contains --> S["Infrastructure Rollout" Section Heading]
    S -- Contains --> C[RunningWorkspacesCard.tsx]
    C -- Uses Hook --> H[useWorkspaceSessions Hook]
    H -- Calls API --> BE[Existing WorkspaceSessions API (via gRPC)]
    C -- Filters Data --> FD[Filtered "Not Stopped" Workspaces List (Array of WorkspaceSession objects)]
    C -- Uses Components --> IL[ItemsList, Item, ItemField]
    C -- Uses Component --> WSI[WorkspaceStatusIndicator]
    C -- Shows --> LDR[Loading Spinner / Error Alert]
    IL -- Renders --> WS[Filtered Workspace Data Rows]
```

### 4. Key Reusable Components/Patterns
*   `useWorkspaceSessions` hook (from `components/dashboard/src/data/insights/list-workspace-sessions-query.ts`)
*   `WorkspaceSession` and `WorkspacePhase_Phase` (from `@gitpod/public-api/lib/gitpod/v1/workspace_pb`)
*   `Timestamp` (from `@bufbuild/protobuf`)
*   `WorkspaceStatusIndicator` (from `components/dashboard/src/workspaces/WorkspaceStatusIndicator.tsx`)
*   `displayTime` function (from `components/dashboard/src/usage/UsageEntry.tsx`)
*   `ItemsList.tsx`, `Item.tsx`, `ItemField.tsx` (from `components/dashboard/src/components/`)
*   `Alert.tsx` (from `components/dashboard/src/components/`)
*   Spinner icon (`Spinner.svg` from `components/dashboard/src/icons/`)
*   Tailwind CSS for styling.
*   `dayjs` for date manipulations (if `from`/`to` params are used with `useWorkspaceSessions`).

### 5. Advantages of this Approach
*   No backend API changes are required.
*   Uses a more direct API (`ListWorkspaceSessions`) for fetching workspace status, likely providing more real-time data than usage billing records.
*   Leverages existing UI components/patterns.

### 6. Potential Considerations
*   **Data Volume & Performance:** `useWorkspaceSessions` uses infinite scrolling. The implementation automatically fetches all pages. If an organization has a vast number of sessions (even if not all are running), this could lead to many API calls. However, the API might be optimized to return only relevant (e.g., non-terminated) sessions by default.
*   **Data Freshness:** The `ListWorkspaceSessions` API is expected to be more real-time than usage data.
*   **`organizationId` Prop:** The `organizationId` prop on `RunningWorkspacesCard` is no longer used as `useWorkspaceSessions` gets this information internally via `useCurrentOrg`.
