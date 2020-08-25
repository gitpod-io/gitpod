/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class RepoWhitelist1538732744233 implements MigrationInterface {

    protected readonly entries = [
        { url: 'https://github.com/demo-apps/go-gin-app.git', description: '**Go** - A simple web app implemented in Go and Gin', priority: 7 },
        { url: 'https://github.com/gitpod-io/rails_sample_app', description: '**Ruby on Rails** - Tutorial sample application', priority: 6 },
        { url: 'https://github.com/ooade/NextSimpleStarter.git', description: '**JavaScript** - Simple PWA boilerplate with Next.js and Redux', priority: 8 },
        { url: 'https://github.com/sibtc/django-beginners-guide', description: '**Python** - A Complete Beginners Guide to Django', priority: 10 },
        { url: 'https://github.com/spring-guides/gs-spring-boot.git', description: '**Java** - Building an Application with Spring Boot', priority: 9 },
        { url: 'https://github.com/symfony/demo.git', description: '**PHP** - Symfony Demo Application', priority: 5 },
        { url: 'https://github.com/theia-ide/theia.git', description: '**Theia** - Deep dive into Gitpods open-source IDE. (TypeScript)', priority: 4 }
    ]

    public async up(queryRunner: QueryRunner): Promise<any> {
        const values = this.entries.map(e => `('${e.url}', '${e.description}', ${e.priority})`).join(",");
        await queryRunner.query(`INSERT IGNORE INTO d_b_repository_white_list (url, description, priority) VALUES ${values}`)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // this is a one-way idempotent 'migration', no rollback possible for a nonempty DB
    }

}
