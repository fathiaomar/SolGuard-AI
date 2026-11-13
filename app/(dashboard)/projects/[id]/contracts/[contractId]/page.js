import WorkspacePage from '../../../../../../components/WorkspacePage'

export default async function ContractPage({ params }) {
  const { id, contractId } = await params
  return <WorkspacePage mode="contract" projectId={id} contractId={contractId} />
}
