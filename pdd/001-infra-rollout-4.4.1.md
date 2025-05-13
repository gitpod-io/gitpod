# Product Design Document: 4.4.1 Schedule Maintenance Notification (API & Backend)

**References:**
*   PRD: [001-infra-rollout.md#4.4. Schedule Maintenance Notification (Optional)](../../prd/001-infra-rollout.md#44-schedule-maintenance-notification-optional)
*   Linear Issue: [CLC-1274](https://linear.app/gitpod/issue/CLC-1274/admin-schedule-maintenance-notification)
*   Related PDD (Maintenance Mode): [pdd/001-infra-rollout-4.3.md](./001-infra-rollout-4.3.md)

## 1. Overview
This document details the technical design for the API and backend components of the "Schedule Maintenance Notification" feature. This feature allows organization owners to enable, disable, and set a custom notification message that can be displayed on the Gitpod dashboard. The actual display logic, including the use of a default message if no custom one is set, will be handled by the frontend (covered in PDD 4.4.2).

## 2. Goals
*   Define the API endpoints for managing scheduled maintenance notification settings (enabled status and custom message).
*   Specify the backend logic for storing and retrieving these settings.
*   Detail necessary database schema modifications for the `DBTeam` entity.
*   Ensure the backend implementation adheres to PRD requirements R4.1, R4.2, R4.3 (backend portion), and supports R4.5.

## 3. Proposed Solution (API & Backend)

### 3.1. Database Schema Update (`gitpod-db`)
*   **Target Entity:** `DBTeam` (represents an "Organization", likely in `components/gitpod-db/src/typeorm/entity/db-team.ts`).
*   **Action:** Add a new column `maintenanceNotification` to the `DBTeam` entity.
    *   **Name:** `maintenanceNotification`
    *   **Type:** `json` (or `jsonb` if preferred by the database)
    *   **Structure:** The JSON object will store:
        ```json
        {
          "enabled": boolean,
          "message": string | undefined
        }
        ```
    *   **Default Value (for the column in DB):** `{"enabled": false, "message": null}`
    *   **Nullable (column itself):** `false` (the column should always exist, its content defines state).
*   **Migration:** A TypeORM migration script will be generated and applied to add this column with its default value.

### 3.2. API Definition (Protobuf - Public API)
*   **Target File:** `components/public-api/gitpod/v1/organization.proto` (or equivalent proto definition file for OrganizationService).
*   **Action:** Add new RPC methods and messages to the `OrganizationService`:
    ```protobuf
    service OrganizationService {
      // ... existing RPCs ...

      // GetScheduledMaintenanceNotification retrieves the scheduled maintenance notification settings for an organization.
      rpc GetScheduledMaintenanceNotification(GetScheduledMaintenanceNotificationRequest) returns (GetScheduledMaintenanceNotificationResponse) {}

      // SetScheduledMaintenanceNotification sets the scheduled maintenance notification for an organization.
      rpc SetScheduledMaintenanceNotification(SetScheduledMaintenanceNotificationRequest) returns (SetScheduledMaintenanceNotificationResponse) {}
    }

    message GetScheduledMaintenanceNotificationRequest {
      string organization_id = 1;
    }

    message GetScheduledMaintenanceNotificationResponse {
      bool is_enabled = 1;
      string message = 2; // The custom message stored, if any. Empty or not present if no custom message is set.
                          // The frontend will use its own default if this is empty/null and is_enabled is true.
    }

    message SetScheduledMaintenanceNotificationRequest {
      string organization_id = 1;
      bool is_enabled = 2;
      optional string custom_message = 3; // User-provided custom message.
                                          // If not provided or empty, the backend stores null/empty for the message.
    }

    message SetScheduledMaintenanceNotificationResponse {
      bool is_enabled = 1; // The new enabled state
      string message = 2; // The custom message that is now stored, if any.
    }
    ```
*   Relevant code generation scripts will be run after this change.

### 3.3. API Implementation (`components/server/src/api/organization-service-api.ts`)
*   The `OrganizationServiceAPI` class will implement the new RPC methods.
*   **`getScheduledMaintenanceNotification` Implementation:**
    *   Input: `GetScheduledMaintenanceNotificationRequest`.
    *   Calls `this.orgService.getScheduledMaintenanceNotificationSettings(ctxUserId(), req.organizationId)`.
    *   Maps the internal result (e.g., `{ enabled: boolean, message: string | null }`) to `GetScheduledMaintenanceNotificationResponse`.
        *   `response.is_enabled = internalResult.enabled;`
        *   `response.message = internalResult.message || "";` (Return empty string if message is null).
*   **`setScheduledMaintenanceNotification` Implementation:**
    *   Input: `SetScheduledMaintenanceNotificationRequest`.
    *   Calls `this.orgService.setScheduledMaintenanceNotificationSettings(ctxUserId(), req.organizationId, req.isEnabled, req.customMessage)`.
    *   Maps the internal result to `SetScheduledMaintenanceNotificationResponse`.
        *   `response.is_enabled = internalResult.enabled;`
        *   `response.message = internalResult.message || "";`

### 3.4. Backend Service Logic (`components/server/src/orgs/organization-service.ts`)
*   The `OrganizationService` class will contain the core logic.
*   **Type definition for the notification settings (internal use):**
    ```typescript
    interface MaintenanceNotificationSettings {
      enabled: boolean;
      message: string | undefined;
    }
    ```
*   **`getScheduledMaintenanceNotificationSettings(userId: string, orgId: string): Promise<MaintenanceNotificationSettings>` method:**
    *   Authorization: `await this.auth.checkPermissionOnOrganization(userId, "maintenance", orgId);`.
    *   Logic:
        *   Fetch `DBTeam` by `orgId` using `this.teamDB.findTeamById(orgId)`.
        *   If not found, throw `ApplicationError(ErrorCodes.NOT_FOUND)`.
        *   Let `dbNotificationConfig = team.maintenanceNotification;`
        *   If `dbNotificationConfig` is null or parsing fails (though TypeORM usually handles JSON column parsing):
            *   Return `{ enabled: false, message: undefined }`.
        *   Else (valid JSON from DB):
            *   Return `{ enabled: dbNotificationConfig.enabled, message: dbNotificationConfig.message === null ? undefined : dbNotificationConfig.message }`.
*   **`setScheduledMaintenanceNotificationSettings(userId: string, orgId: string, isEnabled: boolean, customMessage?: string | null): Promise<MaintenanceNotificationSettings>` method:**
    *   Authorization: `await this.auth.checkPermissionOnOrganization(userId, "maintenance", orgId);`.
    *   Logic:
        *   Fetch `DBTeam`. If not found, throw `ApplicationError(ErrorCodes.NOT_FOUND)`.
        *   Construct the new `MaintenanceNotificationSettings` object for internal logic:
            ```typescript
            const newInternalNotificationConfig: MaintenanceNotificationSettings = {
              enabled: isEnabled,
              message: (customMessage && customMessage.trim() !== "") ? customMessage.trim() : undefined,
            };
            ```
        *   Prepare the object to be stored in the DB (JSON will store `null` for `undefined` message):
            ```typescript
            const notificationConfigForDb = {
              enabled: newInternalNotificationConfig.enabled,
              message: newInternalNotificationConfig.message === undefined ? null : newInternalNotificationConfig.message,
            };
            ```
        *   Prepare update payload for `this.teamDB.updateTeam(orgId, updatePayload)`:
            *   `updatePayload.maintenanceNotification = notificationConfigForDb;` (The DB driver will handle JSON serialization).
        *   Persist changes: `const updatedTeam = await this.teamDB.updateTeam(orgId, updatePayload);`
        *   Analytics:
            ```typescript
            this.analytics.track({
                userId,
                event: isEnabled ? "scheduled_maintenance_notification_enabled" : "scheduled_maintenance_notification_disabled",
                properties: {
                    organization_id: orgId,
                    has_custom_message: isEnabled && !!newInternalNotificationConfig.message,
                },
            });
            ```
        *   Return the `newInternalNotificationConfig` object reflecting the logical state post-update.

## 4. Permissions & Auditing

### 4.1. Permissions
*   Backend service methods (`OrganizationService`) will use `await this.auth.checkPermissionOnOrganization(userId, "maintenance", orgId)` for both `getScheduledMaintenanceNotificationSettings` and `setScheduledMaintenanceNotificationSettings`. This aligns with the permission used for managing the Maintenance Mode feature (4.3) and ensures that users who can manage one can manage the other.

### 4.2. Auditing
*   Analytics tracking as detailed in section 3.4 covers basic auditing of enable/disable actions and presence of a custom message.
*   If more detailed `DbAuditLog` entries are required (e.g., logging the actual message content changes), they can be added within the `setScheduledMaintenanceNotificationSettings` method in `OrganizationService`.

## 5. Open Questions / Considerations (Backend Specific)
*   Ensuring the default value for the `maintenanceNotification` JSON column (`{"enabled": false, "message": null}`) is correctly applied by the migration and handled if the column is ever unexpectedly null.
*   Error handling during JSON parsing from the DB (though TypeORM typically handles this well for JSON columns).
*   The `message` field in `GetScheduledMaintenanceNotificationResponse` and `SetScheduledMaintenanceNotificationResponse` will be an empty string if no custom message is set (i.e., `null` in the DB). The frontend will be responsible for interpreting this as "use frontend default".
