import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from './db';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const db = getDb();

    try {
        const user: any = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // If user has no password (google only), block
        if (!user.password_hash) {
            return res.status(401).json({ message: 'Please login with Google' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email } });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const signup = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const db = getDb();

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const result: any = await db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash]);

        const token = jwt.sign({ id: result.lastID, email }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: result.lastID, email } });
    } catch (error: any) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ error: error.message });
    }
}

export const googleLogin = async (req: Request, res: Response) => {
    const { credential } = req.body; // Google ID Token
    try {
        // If no client ID configured for dev, mock it if needed or error
        if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your-google-client-id') {
            // For local dev without real google creds, maybe strictly require them or fail?
            // Proceeding usually fails verifyIdToken.
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload) {
            return res.status(401).json({ message: 'Invalid Token Payload' });
        }

        const email = payload.email;
        const googleId = payload.sub;

        const db = getDb();
        let user: any = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            // Create user
            const result: any = await db.run('INSERT INTO users (email, google_id) VALUES (?, ?)', [email, googleId]);
            user = { id: result.lastID, email, google_id: googleId };
        } else if (!user.google_id) {
            // Link google ID
            await db.run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email } });

    } catch (error: any) {
        res.status(401).json({ message: 'Invalid Google Token', error: error.message });
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        (req as any).user = user;
        next();
    });
};

export const me = (req: Request, res: Response) => {
    res.json((req as any).user);
};
