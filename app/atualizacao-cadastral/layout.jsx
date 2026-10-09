export const metadata = {
  title: `Atualização cadastral — Congregação ${process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Minha Congregação'}`,
  robots: { index: false, follow: false },
};

export default function CadastroLayout({ children }) {
  return children;
}
