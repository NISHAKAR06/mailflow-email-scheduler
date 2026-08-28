import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import jwt from 'jsonwebtoken';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      httpOptions: {
        timeout: 30000, // 30s timeout prevents outgoing request timeout errors
      },
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard/scheduled`;
    },

    async signIn({ user }) {
      if (!user?.email) return false;

      // Non-blocking sync with backend database
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        fetch(`${apiUrl}/api/auth/sender`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name || user.email.split('@')[0],
          }),
        }).catch(() => {});
      } catch {
        // Continue even if backend is starting up
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.senderId = user.id || user.email;
      }

      // Try to fetch DB senderId from backend
      if (token.email && (!token.senderId || token.senderId === token.email)) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          const res = await fetch(`${apiUrl}/api/auth/sender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: token.email,
              name: token.name,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.sender?.id) {
              token.senderId = data.sender.id;
            }
          }
        } catch {
          // fallback to email
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const activeSenderId = token.senderId || (token.email as string) || 'default-sender';
        (session as any).user.senderId = activeSenderId;

        // Sign a production JWT for Express backend API authorization
        const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'mailflow_jwt_secret';
        const backendToken = jwt.sign(
          {
            email: token.email,
            name: token.name,
            picture: token.picture,
            senderId: activeSenderId,
            sub: token.sub,
          },
          secret,
          { expiresIn: '30d' }
        );
        (session as any).backendToken = backendToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};
