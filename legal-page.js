import { LEGAL_DOCUMENTS, mergeLegalDocuments } from './legal-documents-data.js';
import { renderLegalText } from './legal-text.js';

const slug = document.body.dataset.legalSlug;
const fallback = LEGAL_DOCUMENTS.find((item) => item.slug === slug) || LEGAL_DOCUMENTS[0];
const title = document.querySelector('#legal-title');
const content = document.querySelector('#legal-content');
const updated = document.querySelector('#legal-updated');
const status = document.querySelector('#legal-load-status');
const relatedLink = document.querySelector('#legal-related-link');
const description = document.querySelector('meta[name="description"]');

function displayDocument(item, isFallback = false) {
  title.textContent = item.title;
  document.title = `${item.title} · Fiscalité`;
  if (description) description.content = `${item.title} de l’application Fiscalité proposée par le Cabinet GOBEX.`;
  renderLegalText(content, item.content);

  if (item.updatedAt) {
    const date = new Date(item.updatedAt);
    updated.textContent = Number.isNaN(date.getTime())
      ? ''
      : `Mis à jour le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date)}`;
    updated.hidden = !updated.textContent;
  } else {
    updated.textContent = 'Version de référence';
    updated.hidden = false;
  }

  const other = mergeLegalDocuments().find((legalDocument) => legalDocument.slug !== slug);
  if (other) {
    relatedLink.href = `/${other.slug === 'confidentialite' ? 'confidentialite' : 'conditions-utilisation'}.html`;
    relatedLink.textContent = other.title;
  }

  if (isFallback) {
    status.textContent = 'La version enregistrée en ligne est momentanément indisponible ; la version de référence est affichée.';
    status.hidden = false;
  } else {
    status.hidden = true;
    status.textContent = '';
  }
}

async function loadPublishedDocument() {
  try {
    const response = await fetch('/api/legal-documents', { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const documents = mergeLegalDocuments(payload.documents);
    const current = documents.find((item) => item.slug === slug);
    displayDocument(current || fallback, payload.source === 'fallback');
  } catch (error) {
    displayDocument(fallback, true);
  }
}

displayDocument(fallback);
void loadPublishedDocument();
