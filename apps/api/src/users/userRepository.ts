export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
}

export const emptyUserRepository: UserRepository = {
  async findByEmail() {
    return null;
  },
};

const demoDriver: UserRecord = {
  id: "demo_driver",
  email: "driver@example.com",
  passwordHash:
    "scrypt:bluebluelink-demo-salt:390f6481311b64f4a617155c9c71178b1fe915bac4ecf50d30e4845e4e612430bf01c4f0c1eb079054371bd70e2b16de7b49b64676ed141d39819cae1de9db41",
};

export const demoUserRepository: UserRepository = {
  async findByEmail(email) {
    return email.toLowerCase() === demoDriver.email ? demoDriver : null;
  },
};

export function buildDefaultUserRepository(environment: string): UserRepository {
  return environment === "development" ? demoUserRepository : emptyUserRepository;
}
