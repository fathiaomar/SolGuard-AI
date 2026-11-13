import WorkspacePage from '../../../../components/WorkspacePage'

export default async function ProjectPage({ params }) {
  const { id } = await params
  return <WorkspacePage mode="project" projectId={id} />
}
