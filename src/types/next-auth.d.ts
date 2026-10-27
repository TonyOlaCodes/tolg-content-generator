import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      platformRole: string;
    } & DefaultSession["user"];
  }

  interface User {
    platformRole?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    platformRole?: string;
  }
}
