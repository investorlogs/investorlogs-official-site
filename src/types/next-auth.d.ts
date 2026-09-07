import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    id: string
    role: string
    walletBalance: number
    image?: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      walletBalance: number
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    walletBalance: number
    image?: string | null
  }
}