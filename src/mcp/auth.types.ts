export interface SessionAuth {
  email: string;
  userId: number;
  companyId: number;
  companyType: string;
  role: string;
  cachedToken: string;
  cachedSignature: string;
}
