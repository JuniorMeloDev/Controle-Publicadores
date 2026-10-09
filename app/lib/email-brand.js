import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Inline attachment: email clients can display the logo without fetching a URL.
export async function getEmailLogoAttachment() {
  return {
    filename: 'praia-dos-corais.png',
    content: await readFile(path.join(process.cwd(), 'public', 'logo.png')),
    contentType: 'image/png',
    contentDisposition: 'inline',
    cid: 'congregacao-logo',
  };
}
