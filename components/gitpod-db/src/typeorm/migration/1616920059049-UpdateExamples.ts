/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateExamples1616920059049 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const newEntries = [
            {
                url: 'https://github.com/gitpod-io/sveltejs-template',
                description: 'A project template for Svelte applications',
                priority: 90,
            },
            {
                url: 'https://github.com/gitpod-io/spring-petclinic',
                description: 'A Spring sample web application',
                priority: 70,
            },
            {
                url: 'https://github.com/breatheco-de/python-flask-api-tutorial',
                description: 'An interactive tutorial about Python Flask',
                priority: 40,
            },
            {
                url: 'https://github.com/gitpod-io/ruby-on-rails',
                description: 'A Rails example with PostgreSQL database',
                priority: 30,
            },
            {
                url: 'https://github.com/gitpod-io/dotnetcore',
                description: 'A simple .NET Core application example',
                priority: 20,
            },
            { url: 'https://github.com/symfony/demo', description: 'A Symfony demo application', priority: 10 },
        ];
        // delete old entries
        await queryRunner.query('DELETE FROM d_b_repository_white_list');
        const insert = `INSERT IGNORE INTO d_b_repository_white_list (url, description, priority) VALUES ${newEntries
            .map((e) => '(?, ?, ?)')
            .join(', ')}`;
        const values: any[] = [];
        for (const e of newEntries) {
            values.push(e.url, e.description, e.priority);
        }
        await queryRunner.query(insert, values);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
