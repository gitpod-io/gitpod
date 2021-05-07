import { OAuthAuthCode } from "@jmondi/oauth2-server";
import { OAuthClient } from "@jmondi/oauth2-server";
import { OAuthScope } from "@jmondi/oauth2-server";
import { OAuthToken } from "@jmondi/oauth2-server";
import { OAuthUser } from "@jmondi/oauth2-server";

export interface InMemory {
  users: { [id: string]: OAuthUser };
  clients: { [id: string]: OAuthClient };
  authCodes: { [id: string]: OAuthAuthCode };
  tokens: { [id: string]: OAuthToken };
  scopes: { [id: string]: OAuthScope };

  flush(): void;
}

export const inMemoryDatabase: InMemory = {
  clients: {},
  authCodes: {},
  tokens: {},
  scopes: {},
  users: {},
  flush() {
    this.clients = {};
    this.authCodes = {};
    this.tokens = {};
    this.scopes = {};
    this.users = {};
  },
};

beforeEach(() => {
  inMemoryDatabase.flush();
});