import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions } from 'next-auth';
import jwt from 'jsonwebtoken';

export const authOptions: NextAuthOptions = {
  providers: [
    // 1. Google OAuth Provider (One-click Google Sign In)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      httpOptions: {
        timeout: 30000,
      },
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    // 2. Email & Password Credentials Provider (Direct Email Login)
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email ID', type: 'email', placeholder: 'user@domain.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error('Please enter your Email ID');
        }

        const email = credentials.email.trim().toLowerCase();
        const name = email.split('@')[0] || 'User';

        // Auto-upsert sender in backend if reachable
        try {
          const apiUrl = process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:4000';
          fetch(`${apiUrl}/api/auth/sender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name }),
          }).catch(() => {});
        } catch {
          // ignore
        }

        return {
          id: email,
          email,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          image: null,
        };
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
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard/scheduled`;
    },

    async signIn({ user }) {
      if (!user?.email) return false;

      try {
        const apiUrl = process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:4000';
        fetch(`${apiUrl}/api/auth/sender`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name || user.email.split('@')[0],
          }),
        }).catch(() => {});
      } catch {
        // Continue
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

      if (token.email && (!token.senderId || token.senderId === token.email)) {
        try {
          const apiUrl = process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:4000';
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
