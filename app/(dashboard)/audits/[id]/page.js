import WorkspacePage from '../../../../components/WorkspacePage'

export default async function AuditPage({ params }) {
  const { id } = await params
  return <WorkspacePage mode="audit" auditId={id} />
}
