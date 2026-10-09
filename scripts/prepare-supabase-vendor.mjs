import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const destination = path.join(root, 'public', 'vendor', 'supabase.js');

await mkdir(path.dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log('Prepared local Supabase browser SDK.');
