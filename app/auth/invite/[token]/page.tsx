import InviteForm from './InviteForm';

export default async function InvitePage({ params }: PageProps<'/auth/invite/[token]'>) {
  const { token } = await params;
  return <InviteForm token={token} />;
}
