import { projectsPathMain } from '../../src/projects/projects.routes';
import { settingsPathAccount } from '../../src/settings/settings.routes';
import { workspacesPathMain } from '../../src/workspaces/workspaces.routes';

describe('The app', () => {
    before(() => {
        cy.visit('/');
    });

    it('should load and start from the Workspaces page', () => {
        cy.location('pathname').should('eq', workspacesPathMain);

        cy.findByRole('heading', { name: /Workspaces/i, level: 1 }).should('exist');

        cy.findAllByRole('navigation').last().as('sections').findAllByRole('link').should('have.length', 3);

        cy.get('@sections')
            .findByText(/Workspaces/i)
            .as('workspacesTab')
            .should('exist');
        cy.get('@sections')
            .findByText(/Projects/i)
            .as('projectsTab')
            .should('exist');
        cy.get('@sections')
            .findByText(/Settings/i)
            .as('settingsTab')
            .should('exist');

        cy.get('@projectsTab').click();
        cy.location('pathname').should('eq', projectsPathMain);

        cy.get('@settingsTab').click();
        cy.location('pathname').should('eq', settingsPathAccount);

        cy.get('@workspacesTab').click();
        cy.location('pathname').should('eq', workspacesPathMain);

        // TODO complete checks about the general layout of the app.
        // The "Workspaces" page will have its own spec file.
    });
});

// This empty export is due to `"isolatedModules": true` in the main `tsconfig.json` 🤷🏻
export {};
