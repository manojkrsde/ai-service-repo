export interface SessionAuth {
  email: string;
  userId: number;
  companyId: number;
  companyType: string;
  role: string;
  clientName: string;
  cachedToken: string;
  cachedSignature: string;
  accessToken: string;
}
