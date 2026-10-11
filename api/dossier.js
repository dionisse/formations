/* GET /api/dossier — contenu pédagogique du classeur, servi après vérification de l’accès.
   Le contenu est embarqué dans la fonction (aucun stockage de données) et les fichiers
   sont gérés directement dans le Google Drive du participant (module drive.js côté navigateur). */
import { CLASSEUR_COURSE_VERSION, json, method, requireCourseEntitlement } from './_lib/shared.mjs';
import { dossierData } from './_lib/dossier-data.mjs';

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' });

  const user = await requireCourseEntitlement(req, res, CLASSEUR_COURSE_VERSION);
  if (!user) return;

  return json(res, 200, {
    ...dossierData,
    /* Les fichiers du classeur vivent dans le Drive du participant : leur inventaire
       est chargé par le navigateur via drive.js, jamais servi ici. */
    files: [],
    filesSource: 'drive',
    courseVersion: CLASSEUR_COURSE_VERSION
  });
}
