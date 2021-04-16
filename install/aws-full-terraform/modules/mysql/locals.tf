/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

locals {
  database = {
    host     = aws_db_instance.gitpod.address
    port     = aws_db_instance.gitpod.port
    username = aws_db_instance.gitpod.username
    password = aws_db_instance.gitpod.password
  }
}
