import type { Database } from '../types';
import dbJson from '../../data/db.json';

export const DEFAULT_DB: Database = dbJson as unknown as Database;
