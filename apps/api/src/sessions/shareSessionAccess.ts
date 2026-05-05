export interface ShareSessionAccessRepository {
  isOwner(sessionId: string, userId: string): Promise<boolean>;
}

export const denyAllShareSessionAccess: ShareSessionAccessRepository = {
  async isOwner() {
    return false;
  },
};
