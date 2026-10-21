import Studio from '@/components/studio/Studio';

export default async function Page({ params, searchParams }: PageProps<'/[[...slug]]'>) {
  const { slug } = await params;
  const sp = await searchParams;
  const project = typeof sp.project === 'string' ? sp.project : '';
  return <Studio initialPath={'/' + (slug || []).join('/')} initialProject={project} />;
}
