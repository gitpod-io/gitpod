# Product Requirements Document: Improved Infrastructure Update Rollout Experience

**Tracking Issue:** [CLC-1272](https://linear.app/gitpod/issue/CLC-1272/improve-infra-update-rollout-experience)

## 1. Overview

This document outlines the requirements for improving the infrastructure update rollout experience for Gitpod administrators. The goal is to provide administrators with better tools for visibility, communication, and control during infrastructure maintenance, thereby reducing operational stress and minimizing the risk of incidents.

## 2. Background

Customers have reported significant challenges in coordinating infrastructure updates for their Gitpod installations. These challenges stem from several factors:
*   **Long Workspace Timeouts:** Workspaces can run for extended periods (e.g., 36 hours), making it difficult to find a suitable maintenance window without disrupting users.
*   **Ineffective Communication:** Company-internal communication channels and email announcements regarding maintenance are often missed or ignored by users.
*   **Lack of Determinism:** The unpredictability of user activity and workspace states during updates makes the process stressful for administrators.

These issues have led to difficult update experiences and, in some cases, service incidents, including data loss for customers. This project aims to address these problems by introducing a dedicated admin interface with tools to manage maintenance periods more effectively.

## 3. Goals

*   Improve the predictability and reduce the stress of infrastructure updates for administrators.
*   Minimize disruption to end-users during maintenance windows.
*   Reduce the risk of data loss or other incidents related to infrastructure updates.
*   Provide administrators with clear visibility into running workspaces.
*   Enable administrators to effectively communicate upcoming maintenance to users.
*   Give administrators control over workspace creation and termination during maintenance.

## 4. Requirements

An "Admin" section will be added to the Gitpod organization menu. This section will house the following features:

### 4.1. View Running Workspaces (Ref: [CLC-1240](https://linear.app/gitpod/issue/CLC-1240/admin-ability-to-see-running-workspaces))
*   **R1.1:** Administrators must be able to view a list of all currently running workspaces within their organization.
*   **R1.2:** The list should include relevant information for each workspace (e.g., user, workspace ID, start time, project).
*   **R1.3:** This feature aims to restore or provide similar functionality to a previously available view that helped admins identify active users during upgrades.

### 4.2. Maintenance Mode Toggle (Ref: [CLC-1273](https://linear.app/gitpod/issue/CLC-1273/admin-maintenance-mode-toggle))
*   **R2.1:** Administrators must be able to manually enable or disable a "Maintenance Mode" for their Gitpod instance.
*   **R2.2:** When Maintenance Mode is enabled:
    *   Users must be prevented from starting new workspaces.
    *   A clear warning or notification must be displayed on the dashboard indicating that the system is in maintenance.
*   **R2.3:** This toggle allows administrators to control the state before, during, and after an update.

### 4.3. Stop All Running Workspaces (Ref: [CLC-1275](https://linear.app/gitpod/issue/CLC-1275/admin-stop-all-running-workspaces-button-for-infra-update))
*   **R3.1:** Administrators must have an option (e.g., a button) to stop all currently running workspaces within their organization.
*   **R3.2:** This action is intended to ensure all running workspaces are backed up before an infrastructure update.
*   **R3.3:** The UI should provide a clear explanation of what this action does and its implications.
*   **R3.4:** This functionality must be disabled if Maintenance Mode is not active. It should only be usable when Maintenance Mode is enabled.

### 4.4. Schedule Maintenance Notification (Optional) (Ref: [CLC-1274](https://linear.app/gitpod/issue/CLC-1274/admin-schedule-maintenance-notification))
*   **R4.1:** Administrators must be able to schedule and display a maintenance notification banner on the Gitpod dashboard.
*   **R4.2:** The notification system must include an enable/disable toggle.
*   **R4.3:** Administrators must be able to provide custom text for the notification banner to explain the purpose, timing, and impact of the maintenance.
*   **R4.4:** A default notification message should be provided if no custom text is set.

## 5. Design Considerations (High-Level)

*   The new "Admin" page should be easily accessible from the organization menu.
*   The UI for these features should be intuitive and provide clear feedback to the administrator.
*   Actions with significant impact (e.g., stopping all workspaces) should require confirmation.

## 6. Technical Considerations (High-Level)

*   **API Endpoints:** New API endpoints will be required for the dashboard to interact with the backend for these admin functions.
*   **Permissions:** Access to the "Admin" page and its functionalities must be restricted to users with appropriate administrative roles/permissions within the organization.
*   **State Management:** The state of maintenance mode and scheduled notifications needs to be persisted and consistently reflected across the system.
*   **Impact on Existing Systems:** Changes to workspace lifecycle management (preventing starts, stopping all) need careful integration with `ws-manager` and related components.
*   **Auditing:** Actions performed via this admin interface (e.g., enabling maintenance mode, stopping workspaces) should be auditable.

## 7. Testing Considerations

*   **Functional Testing:** Each feature (viewing workspaces, notifications, maintenance mode, stopping workspaces) must be tested thoroughly.
*   **Permissions Testing:** Verify that only authorized administrators can access and use these features.
*   **UI/UX Testing:** Ensure the admin interface is user-friendly and provides clear information.
*   **Integration Testing:** Test the interaction of these features with other parts of the Gitpod system (e.g., workspace startup flow, dashboard display).
*   **Scenario Testing:** Test various scenarios, such as:
    *   Scheduling a notification and then disabling it.
    *   Enabling maintenance mode while users are attempting to start workspaces.
    *   Stopping all workspaces when some are idle and some are active.

## 8. Deployment Considerations

*   These features will be rolled out as part of a standard Gitpod update.
*   Documentation for administrators on how to use these new features will be required.
*   Consider feature flagging for a phased rollout if deemed necessary.

## 9. Open Questions

No open questions at this time.
