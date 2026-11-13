import { Buffer } from 'node:buffer'
import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '../../../lib/request-security.mjs'
import { createSupabaseServerClient } from '../../../lib/supabase-server'
import { scanSource } from '../../../services/staticAnalyzer.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_SOURCE_BYTES = 500 * 1024
const MAX_REQUEST_BYTES = 3 * 1024 * 1024
const EMPTY_SETTINGS = {
  displayName: '',
  email: '',
  notifications: { inApp: true, email: false, security: true },
  appearance: 'dark',
}

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function validateId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function schemaNotReady(error) {
  return error?.code === '42703' || error?.code === '42P01' ||
    error?.code === '42883' || error?.code === 'PGRST202'
}

function schemaErrorResponse() {
  return jsonError('The Supabase database schema is out of date. Run the latest supabase-schema.sql in your Supabase SQL Editor, then reload the workspace.', 409)
}

async function getWorkspace(supabase, user) {
  const [projectResult, contractResult, auditResult, profileResult] = await Promise.all([
    supabase.from('projects').select('id,name,network,created_at,updated_at').order('created_at', { ascending: false }),
    supabase.from('contracts').select('id,project_id,name,source_code,created_at,updated_at').order('created_at', { ascending: false }),
    supabase.from('audits').select('id,contract_id,status,findings,summary,analysis,created_at,scan_type').order('created_at', { ascending: false }),
    supabase.from('profiles').select('display_name,preferences').eq('id', user.id).maybeSingle(),
  ])
  const error = projectResult.error || contractResult.error || auditResult.error || profileResult.error
  if (error) throw error

  const contracts = contractResult.data || []
  const projects = (projectResult.data || []).map((project) => ({
    id: project.id,
    name: project.name,
    network: project.network || 'Ethereum',
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    contracts: contracts.filter((contract) => contract.project_id === project.id).map((contract) => ({
      id: contract.id,
      name: contract.name,
      size: new TextEncoder().encode(contract.source_code).length,
      source: contract.source_code,
      uploadedAt: contract.created_at,
      updatedAt: contract.updated_at,
    })),
  }))
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]))
  const audits = (auditResult.data || []).map((audit) => {
    const contract = contractById.get(audit.contract_id)
    const project = contract ? projectById.get(contract.project_id) : null
    return {
      id: audit.id,
      projectId: project?.id || '',
      projectName: project?.name || 'Deleted project',
      contractId: audit.contract_id,
      contractName: contract?.name || 'Deleted contract',
      createdAt: audit.created_at,
      findings: audit.findings || [],
      summary: audit.summary || '',
      analysis: audit.analysis || {},
      scanType: audit.scan_type === 'Heuristic preview'
        ? 'Legacy scan (no saved analysis)'
        : audit.scan_type || 'Legacy scan (no saved analysis)',
      status: audit.status,
    }
  })
  const preferences = profileResult.data?.preferences || {}
  const settings = {
    ...EMPTY_SETTINGS,
    ...preferences,
    displayName: profileResult.data?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Auditor workspace',
    email: user.email || '',
    notifications: { ...EMPTY_SETTINGS.notifications, ...preferences.notifications },
  }

  return { projects, audits, settings }
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error && ![400, 401, 403].includes(error.status)) {
    return { error: jsonError('Authentication service is unavailable.', 503) }
  }
  if (!user) return { error: jsonError('Authentication required.', 401) }
  return { supabase, user }
}

export async function GET() {
  try {
    const auth = await authenticatedClient()
    if (auth.error) return auth.error
    const workspace = await getWorkspace(auth.supabase, auth.user)
    return NextResponse.json(workspace, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Unable to load the authenticated workspace.', error)
    if (schemaNotReady(error)) return schemaErrorResponse()
    return jsonError('Workspace data could not be loaded.', 500)
  }
}

export async function POST(request) {
  try {
    const auth = await authenticatedClient()
    if (auth.error) return auth.error
    if (!isSameOriginRequest(request)) {
      return jsonError('Cross-origin requests are not allowed.', 403)
    }

    const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (mediaType !== 'application/json') {
      return jsonError('Content-Type must be application/json.', 415)
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonError('Request body exceeds the allowed size.', 413)
    }

    let body
    try {
      const reader = request.body?.getReader()
      if (!reader) return jsonError('Request body is required.')
      const chunks = []
      let totalBytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > MAX_REQUEST_BYTES) {
          await reader.cancel()
          return jsonError('Request body exceeds the allowed size.', 413)
        }
        chunks.push(Buffer.from(value))
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      return jsonError('Request body must be valid JSON.')
    }

    const { supabase, user } = auth
    let result
    switch (body?.action) {
      case 'create_project': {
        const { id, name, network } = body
        if (!validateId(id) || typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
            typeof network !== 'string' || !network.trim() || network.trim().length > 40) {
          return jsonError('Project details are invalid.')
        }
        result = await supabase.from('projects').insert({
          id, user_id: user.id, name: name.trim(), network: network.trim(),
        })
        break
      }
      case 'delete_project': {
        if (!validateId(body.projectId)) return jsonError('Project ID is invalid.')
        const { data: deleted, error } = await supabase.rpc('delete_project_with_data', {
          p_project_id: body.projectId,
        })
        if (error) throw error
        if (deleted !== true) return jsonError('Project not found.', 404)
        result = { error: null }
        break
      }
      case 'create_contract': {
        const { id, projectId, name, source } = body
        if (!validateId(id) || !validateId(projectId) || typeof name !== 'string' ||
            !/^[^\\/:*?"<>|]+\.sol$/i.test(name) || name.length > 255 ||
            typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) {
          return jsonError('Contract details are invalid or the source exceeds the 500 KB limit.')
        }
        const { data: project, error: projectError } = await supabase.from('projects')
          .select('id').eq('id', projectId).maybeSingle()
        if (projectError) throw projectError
        if (!project) return jsonError('Project not found.', 404)
        result = await supabase.from('contracts').insert({
          id, user_id: user.id, project_id: projectId, name, source_code: source,
        })
        break
      }
      case 'update_contract': {
        const { contractId, source } = body
        if (!validateId(contractId) || typeof source !== 'string' ||
            new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) {
          return jsonError('Contract update is invalid or the source exceeds the 500 KB limit.')
        }
        result = await supabase.from('contracts').update({ source_code: source })
          .eq('id', contractId).select('id').maybeSingle()
        if (!result.error && !result.data) return jsonError('Contract not found.', 404)
        break
      }
      case 'delete_contract': {
        if (!validateId(body.contractId)) return jsonError('Contract ID is invalid.')
        result = await supabase.from('contracts').delete().eq('id', body.contractId).select('id').maybeSingle()
        if (!result.error && !result.data) return jsonError('Contract not found.', 404)
        break
      }
      case 'create_audit': {
        const { id, projectId, contractId } = body
        if (!validateId(id) || !validateId(projectId) || !validateId(contractId)) {
          return jsonError('Audit details are invalid.')
        }
        const { data: contract, error } = await supabase
          .from('contracts')
          .select('name,source_code,compiler_version,project_id')
          .eq('id', contractId)
          .eq('project_id', projectId)
          .maybeSingle()
        if (error) throw error
        if (!contract) return jsonError('Contract not found in this workspace.', 404)
        let scan
        try {
          scan = scanSource(contract.source_code)
        } catch (scanError) {
          return jsonError(scanError.message || 'The Solidity source could not be analyzed.', 422)
        }
        const audit = {
          id,
          user_id: user.id,
          contract_id: contractId,
          status: 'completed',
          findings: scan.findings,
          summary: scan.summary,
          analysis: scan.analysis,
          scan_type: 'Static AST pattern analysis',
          completed_at: new Date().toISOString(),
        }
        result = await supabase.from('audits').insert(audit)
        if (result.error?.code === '23502' &&
            /(contract_name|source_code|compiler_version)/i.test(result.error.message || '')) {
          result = await supabase.from('audits').insert({
            ...audit,
            contract_name: contract.name,
            source_code: contract.source_code,
            compiler_version: contract.compiler_version || 'unknown',
          })
        }
        break
      }
      case 'update_settings': {
        const { displayName, appearance, notifications } = body.settings || {}
        if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 80 ||
            !['dark', 'light', 'system'].includes(appearance) ||
            !notifications || typeof notifications.inApp !== 'boolean' ||
            typeof notifications.email !== 'boolean' || typeof notifications.security !== 'boolean') {
          return jsonError('Workspace settings are invalid.')
        }
        const { data: profile, error } = await supabase.from('profiles')
          .update({
            display_name: displayName.trim(),
            preferences: { appearance, notifications },
          })
          .eq('id', user.id)
          .select('id')
          .maybeSingle()
        if (error) throw error
        if (!profile) return jsonError('Account profile is unavailable. Re-run the Supabase schema setup.', 409)
        result = { error: null }
        break
      }
      default:
        return jsonError('Unsupported workspace action.')
    }

    if (result?.error) {
      console.error('Workspace mutation failed.', result.error)
      if (body.action === 'create_audit' && result.error.code === '23502') {
        return jsonError('The Supabase audits table still requires legacy fields. Run the latest supabase-schema.sql in your Supabase SQL Editor, then retry the pattern check.', 409)
      }
      return jsonError('Workspace changes could not be saved.', 500)
    }

    const workspace = await getWorkspace(supabase, user)
    return NextResponse.json(workspace, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Workspace request failed.', error)
    if (schemaNotReady(error)) return schemaErrorResponse()
    return jsonError('Workspace request could not be completed.', 500)
  }
}
