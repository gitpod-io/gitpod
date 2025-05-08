# PDD: Admin Page Scaffolding - Infra Rollout

- **Associated PRD**: [prd/001-infra-rollout.md](prd/001-infra-rollout.md)
- **Associated PRD Task**: Admin Page Scaffolding (Create basic Admin page structure in Dashboard, accessible via org menu)
- **Date**: May 8, 2025
- **Author**: Cline
- **Version**: 1.0
- **Status**: Draft

## 1. Overview
This document outlines the design for the initial scaffolding of an "Admin" page within the Gitpod Dashboard. This page will serve as the foundation for future administrative features aimed at improving the infrastructure update rollout experience, as detailed in `prd/001-infra-rollout.md`. The primary goal of this specific task is to create the basic UI structure for the Admin page and make it accessible via the organization menu.

## 2. Background
Administrators require better tools for managing Gitpod installations during maintenance periods. The "Admin Page Scaffolding" is the first step towards providing a centralized location for these tools. This initial setup will not include functional administrative features but will establish the necessary routing, basic page structure, and navigation link.

## 3. Proposed Design & Implementation

### 3.1. Affected Code Units
The changes will primarily be within the `dashboard` component:

- `components/dashboard/src/app/AppRoutes.tsx` (the primary router configuration file): To add a new route for the Admin page.
- `components/dashboard/src/menu/OrganizationSelector.tsx` (the organization menu component): To add a navigation link to the new Admin page, *conditionally rendered based on user role ("owner")*.
- `components/dashboard/src/org-admin/AdminPage.tsx` (new file): The React component for the Admin page itself, *which will include logic for role checking and redirection*.

### 3.2. Key Methods/Functions to Modify/Create

- **Router Configuration (`components/dashboard/src/app/AppRoutes.tsx`)**:
    - Modify the existing routing setup to include a new route definition.
    - Route: `/org-admin`, placed next to other organization routes.

- **Organization Menu Component (`components/dashboard/src/menu/OrganizationSelector.tsx`)**:
    - Utilizes the `useIsOwner` hook (from `../data/organizations/members-query`) to determine if the current user is an owner of the selected organization.
    - Conditionally render a new "Admin" link within the organization-specific menu *only if `isOwner` is true*.
    - The link should navigate to the `/org-admin` route.

- **Admin Page Component (`components/dashboard/src/org-admin/AdminPage.tsx`)**:
    - Create a new React functional component named `AdminPage`.
    - Utilizes `useIsOwner` hook for role checking.
    - Implements logic in a `useEffect` hook: if `isOwner` is false (after relevant data like user and current organization has loaded), redirect the user. The redirect path will be to the organization's workspaces page (e.g., `/org/:orgId/workspaces`, where `orgId` is obtained from `useCurrentOrg`, or a generic `/workspaces` path).
    - If `isOwner` is true, this component will render the basic layout for the admin section using `<PageHeading title="Administration" subtitle="Administrative tools and settings will be available here." />`.
    - Uses `useDocumentTitle("Administration")` to set the browser tab title.
    - Example structure (simplified):
      ```tsx
      import React, { useEffect } from 'react';
      import { useHistory } from 'react-router-dom';
      import { useUserLoader } from '../hooks/use-user-loader';
      import { useCurrentOrg } from '../data/organizations/orgs-query';
      import { useIsOwner } from '../data/organizations/members-query';
      import { useDocumentTitle } from '../hooks/use-document-title';
      import { PageHeading } from '@podkit/layout/PageHeading';

      const AdminPage: React.FC = () => {
        useDocumentTitle("Administration");
        const history = useHistory();
        const { loading: userLoading } = useUserLoader();
        const { data: currentOrg, isLoading: orgLoading } = useCurrentOrg();
        const isOwner = useIsOwner();

        useEffect(() => {
          if (userLoading || orgLoading) { return; }
          if (!isOwner) {
            const redirectPath = currentOrg?.id ? `/org/${currentOrg.id}/workspaces` : '/workspaces';
            history.replace(redirectPath);
          }
        }, [isOwner, userLoading, orgLoading, history, currentOrg?.id]);

        if (userLoading || orgLoading || !isOwner) {
          return null; // Or loading indicator
        }

        return (
          <div className="app-container pb-8">
            <PageHeading title="Administration" subtitle="Administrative tools and settings will be available here." />
            {/* Placeholder for future admin feature sections */}
          </div>
        );
      };

      export default AdminPage;
      ```

### 3.3. New Code Units
- `components/dashboard/src/org-admin/AdminPage.tsx`: This will be a new file containing the React component for the admin page.
- A new directory `components/dashboard/src/org-admin/` will be created.

### 3.4. Data Model Changes
- None for this scaffolding task.

### 3.5. API Endpoint Changes
- None directly for this UI scaffolding task.
- **Future Dependency**: The PRD notes that API endpoints on the `server` component will be required for permission checks and all subsequent administrative functionalities. This PDD does not cover those API changes.

## 4. Design Rationale
- **Simplicity**: The initial scaffolding should be minimal, providing only the necessary structure to build upon.
- **Consistency**: The new Admin page and its navigation link should follow existing UI/UX patterns within the Gitpod dashboard for a consistent user experience.
- **Extensibility**: The `AdminPage.tsx` component should be structured to easily accommodate the addition of various admin feature sections (View Workspaces, Maintenance Mode, etc.) as defined in the PRD.

## 5. Impact Analysis
- **Dependencies**: This task is a prerequisite for implementing all other admin features outlined in `prd/001-infra-rollout.md`.
- **Performance**: Negligible impact, as it involves adding a new route and a simple UI component.
- **Security**:
    - No direct backend security implications from the UI scaffolding itself.
    - **Frontend Access Control**: The conditional rendering of the menu link and client-side redirection for non-owners provide a good user experience and a first layer of access control.
    - **Crucial Note**: These client-side checks are *not a substitute for backend authorization*. Access to any actual administrative functionalities and their corresponding API endpoints *must* be strictly controlled by robust permission checks on the `server` component. This PDD focuses on UI scaffolding; backend security is a separate, critical concern.
- **Scalability**: Not applicable for this UI scaffolding task.

## 6. Testing Strategy
- **Manual Testing**:
    - Verify that the "Admin" link appears in the organization menu *only for users with the "owner" role* (for the currently selected organization) and is hidden for other roles.
    - Verify that clicking the "Admin" link (for an owner) navigates to the new `/org-admin` page.
    - Verify that the Admin page displays the "Administration" heading and subtitle for an owner.
    - Verify that the `/org-admin` route works correctly within the context of the currently selected organization.
    - *Verify that users with roles other than "owner" are redirected to the workspaces page if they attempt to navigate to the `/org-admin` URL directly.*

## 7. Rollout Plan
- This change will be part of a standard Gitpod `dashboard` component update.
- No specific user-facing documentation is required for the scaffolding itself, but it sets the stage for features that will require documentation.

## 8. Open Questions & Risks
- **Resolved**: The organization menu component has been identified as `components/dashboard/src/menu/OrganizationSelector.tsx`.
- **Risk of Premature Access**: If permission checks for the Admin link/page are not implemented promptly in subsequent tasks, users without admin rights might be able to navigate to an empty admin page. This is a minor risk for the scaffolding phase but becomes critical as features are added. (This risk remains but the component is identified).

## 9. Future Considerations
- This PDD covers only the initial UI scaffolding. All functional aspects, including:
    - Fetching and displaying running workspaces
    - Maintenance mode toggle logic and API integration
    - Stopping all workspaces logic and API integration
    - Scheduled maintenance notifications
    - Backend API endpoints for these features
    - Robust permission checks for accessing the admin page and its functionalities
  will be covered in separate PDDs and implementation tasks.
