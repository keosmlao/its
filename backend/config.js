import 'dotenv/config';

export const DB_HOST = process.env.DB_HOST || '183.182.125.245';
export const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
export const DB_NAME = process.env.DB_NAME || 'it_db';
export const DB_USER = process.env.DB_USER || 'postgres';
export const DB_PASSWORD = process.env.DB_PASSWORD || 'od@2022';

export const ERP_DB_HOST = process.env.ERP_DB_HOST || '183.182.125.245';
export const ERP_DB_PORT = parseInt(process.env.ERP_DB_PORT || '5432', 10);
export const ERP_DB_NAME = process.env.ERP_DB_NAME || 'odg';
export const ERP_DB_USER = process.env.ERP_DB_USER || 'postgres';
export const ERP_DB_PASSWORD = process.env.ERP_DB_PASSWORD || 'od@2022';

export const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
export const JWT_EXPIRES_MINUTES = parseInt(process.env.JWT_EXPIRES_MINUTES || '720', 10);
export const AUTH_DISABLED = process.env.AUTH_DISABLED === '1';
export const DEBUG = process.env.FLASK_DEBUG === '1';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
export const UPLOAD_DIR = process.env.UPLOAD_DIR || new URL('./storage/uploads', import.meta.url).pathname;

export const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '';
export const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
export const LINE_CALLBACK_URL = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL || '';

export const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
export const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
export const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Administrator';
export const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE || 'manager';
