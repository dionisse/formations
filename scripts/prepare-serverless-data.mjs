/* Génère le module embarqué du dossier pédagogique pour les fonctions serverless.
   Le contenu payant n’est jamais déposé dans un stockage : il est inclus dans la
   fonction, qui le sert uniquement après vérification de l’accès côté serveur. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'private', 'dossier-data.json');
const destination = path.join(root, 'api', '_lib', 'dossier-data.mjs');

const dossier = JSON.parse(await readFile(source, 'utf8'));
const banner = `/* Fichier généré par scripts/prepare-serverless-data.mjs — ne pas modifier à la main.
   Source : private/dossier-data.json */\n`;

await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, `${banner}export const dossierData = ${JSON.stringify(dossier, null, 2)};\n`);
console.log(`Prepared embedded dossier data (${dossier.folders?.length || 0} rubriques principales).`);
