function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function buildPasswordResetEmail({ name, link }) {
  const url = new URL(link);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid reset URL');
  const displayName = typeof name === 'string' && name.trim() ? name.trim() : 'publicador';
  const safeName = escapeHtml(displayName);
  const safeLink = escapeHtml(url.href);
  const subject = 'Redefina sua senha — Praia dos Corais';
  const text = `PRAIA DOS CORAIS\nControle de Publicadores\n\nOlá, ${displayName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta no Controle de Publicadores da Congregação Praia dos Corais.\n\nPara criar uma nova senha e voltar a acessar sua conta, abra o link abaixo:\n${url.href}\n\nEste link é válido por 30 minutos e pode ser usado apenas uma vez. Sua senha atual continuará válida até que você conclua a alteração.\n\nNão solicitou esta alteração? Ignore este e-mail. Nenhuma mudança será feita na sua senha. Por segurança, não compartilhe este link com outras pessoas.\n\nSe o link tiver expirado, solicite outro pela opção “Esqueci minha senha” na tela de acesso.\n\nCongregação Praia dos Corais\nMensagem automática do Controle de Publicadores.`;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#f4f3f8;font-family:Arial,Helvetica,sans-serif;color:#27272a;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Olá, ${safeName}! Use este link para criar uma nova senha. Válido por 30 minutos.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f3f8;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 32px;background-color:#302043;border-radius:16px 16px 0 0;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:2px;color:#d8b4fe;">PRAIA DOS CORAIS</p>
        <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;">Controle de Publicadores</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#7e22ce;">SEGURANÇA DA SUA CONTA</p>
        <h1 style="margin:0 0 24px;font-size:28px;line-height:36px;color:#18181b;">Vamos redefinir sua senha?</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Olá, <strong>${safeName}</strong>!</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#52525b;">Recebemos uma solicitação para redefinir a senha da sua conta no Controle de Publicadores da Congregação Praia dos Corais.</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#52525b;">Clique no botão abaixo para criar uma nova senha e voltar a acessar sua conta.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#7e22ce" style="border-radius:8px;mso-padding-alt:16px 28px;">
          <a href="${safeLink}" style="display:inline-block;padding:16px 28px;border:1px solid #7e22ce;border-radius:8px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">Redefinir minha senha</a>
        </td></tr></table>
        <p style="margin:16px 0 24px;font-size:13px;line-height:21px;color:#71717a;">Válido por <strong>30 minutos</strong> · Uso único</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:18px;background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#581c87;">Não solicitou esta alteração?</p>
          <p style="margin:0;font-size:14px;line-height:22px;color:#52525b;">Ignore este e-mail. Sua senha atual continuará válida até que a alteração seja concluída. Por segurança, não compartilhe este link com outras pessoas.</p>
        </td></tr></table>
        <p style="margin:24px 0 8px;font-size:13px;line-height:21px;color:#71717a;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
        <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeLink}" style="color:#7e22ce;text-decoration:underline;word-break:break-all;">${safeLink}</a></p>
        <p style="margin:20px 0 0;font-size:13px;line-height:21px;color:#71717a;">O link expirou? Solicite outro pela opção “Esqueci minha senha” na tela de acesso.</p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;background-color:#fafafa;border-radius:0 0 16px 16px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#52525b;">Congregação Praia dos Corais</p>
        <p style="margin:0;font-size:12px;line-height:20px;color:#71717a;">Mensagem automática do Controle de Publicadores.<br>Você recebeu este e-mail porque foi solicitada a redefinição de senha para sua conta.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, text, html };
}
