/* Rendu sécurisé du texte juridique simple : aucun HTML fourni par l'éditeur n'est interprété. */
export function renderLegalText(container, value) {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  const blocks = text ? text.split(/\n[\t ]*\n+/) : [];
  const fragment = document.createDocumentFragment();

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    if (lines.length === 1 && /^\d{1,2}\.\s+.{2,140}$/.test(lines[0])) {
      const heading = document.createElement('h2');
      heading.textContent = lines[0];
      fragment.append(heading);
      continue;
    }

    if (lines.every((line) => /^[-•]\s+/.test(line))) {
      const list = document.createElement('ul');
      for (const line of lines) {
        const item = document.createElement('li');
        item.textContent = line.replace(/^[-•]\s+/, '');
        list.append(item);
      }
      fragment.append(list);
      continue;
    }

    const paragraph = document.createElement('p');
    paragraph.textContent = lines.join('\n');
    fragment.append(paragraph);
  }

  container.replaceChildren(fragment);
}
