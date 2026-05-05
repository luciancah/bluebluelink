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
