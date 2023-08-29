export interface AuthenticationToken {
  readonly bearerToken: string
  readonly expiresInMilliseconds: number
}
