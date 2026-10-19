import { supabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/festivals/view
 * Supabase DB에서 모든 축제의 실시간 조회수(view_count) 맵 반환
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('festivals')
      .select('id, title, view_count')

    if (error) {
      return Response.json({ counts: {} })
    }

    const counts: Record<string, number> = {}
    if (Array.isArray(data)) {
      for (const row of data) {
        if (row.id) {
          const c = Number(row.view_count) || 0
          const rawId = String(row.id)
          const numId = rawId.replace(/\D/g, '')

          counts[rawId] = c
          if (numId) {
            counts[numId] = c
            counts[`tour_fest_${numId}`] = c
            counts[`tour_${numId}`] = c
            counts[`festival_${numId}`] = c
          }
          if (row.title) {
            counts[String(row.title).trim().toLowerCase()] = c
          }
        }
      }
    }

    return Response.json({ counts })
  } catch (err) {
    console.warn('[view-api] GET view counts error:', err)
    return Response.json({ counts: {} })
  }
}

/**
 * POST /api/festivals/view
 * 특정 축제 상세 조회 시 Supabase DB에 조회수 1 증가 (RPC increment_view_count 또는 upsert)
 */
export async function POST(request: Request) {
  try {
    let rawId = ''
    let title = ''

    const text = await request.text().catch(() => '')
    try {
      const body = JSON.parse(text)
      rawId = String(body.eventId || body.id || '').trim()
      title = String(body.title || '').trim()
    } catch {
      rawId = String(text).replace(/["'{}]/g, '').trim()
    }

    if (!rawId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 })
    }

    const cleanId = rawId.replace(/^tour_fest_|^festival_/, '')

    // 1. RPC 함수 increment_view_count 호출 (SECURITY DEFINER로 RLS 우회)
    try {
      const { error: rpcError } = await supabase.rpc('increment_view_count', {
        p_event_id: cleanId,
        p_title: title,
      })

      if (!rpcError) {
        return Response.json({ success: true, eventId: cleanId, method: 'rpc' })
      }

      // 파라미터명 별칭 시도
      const { error: aliasError } = await supabase.rpc('increment_view_count', {
        event_id: cleanId,
        event_title: title,
      })

      if (!aliasError) {
        return Response.json({ success: true, eventId: cleanId, method: 'rpc_alias' })
      }
    } catch {
      // RPC 미존재 시 테이블 직접 upsert
    }

    // 2. festivals 테이블에 upsert 시도
    const { error: tableError } = await supabase.from('festivals').upsert(
      {
        id: cleanId,
        title,
        view_count: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (tableError) {
      console.warn('[view-api] Supabase upsert error:', tableError.message)
    }

    return Response.json({ success: true, eventId: cleanId, method: 'table_upsert' })
  } catch (err) {
    console.error('[view-api] POST handler error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
