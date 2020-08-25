/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRepoWhitelist1554360209832 implements MigrationInterface {

    protected readonly entries = [
        { url: 'https://github.com/gitpod-io/go-gin-app.git', description: '**Go** - A simple web app implemented in Go and Gin', priority: 7 },
        { url: 'https://github.com/gitpod-io/rails_sample_app', description: '**Ruby on Rails** - Tutorial sample application', priority: 6 },
        { url: 'https://github.com/gitpod-io/NextSimpleStarter.git', description: '**JavaScript** - Simple PWA boilerplate with Next.js and Redux', priority: 8 },
        { url: 'https://github.com/gitpod-io/django-locallibrary-tutorial', description: '**Python** - Tutorial "Local Library" website written in Django', priority: 10 },
        { url: 'https://github.com/gitpod-io/gs-spring-boot.git', description: '**Java** - Building an Application with Spring Boot', priority: 9 },
        { url: 'https://github.com/gitpod-io/symfony-demo.git', description: '**PHP** - Symfony Demo Application', priority: 5 },
        { url: 'https://github.com/theia-ide/theia.git', description: '**Theia** - Deep dive into Gitpods open-source IDE. (TypeScript)', priority: 4 }
    ]

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query('DELETE FROM d_b_repository_white_list');

        const values = this.entries.map(e => `('${e.url}', '${e.description}', ${e.priority})`).join(",");
        await queryRunner.query(`INSERT IGNORE INTO d_b_repository_white_list (url, description, priority) VALUES ${values}`)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // this is a one-way idempotent 'migration', no rollback possible for a nonempty DB
    }

}
