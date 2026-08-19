'use server';

import { createClient } from '@/lib/supabase/server';
import { getWIBDayBoundsUtc } from '@/lib/utils/time';

/**
 * Server action untuk paginasi riwayat kunjungan marketing (load more)
 */
export async function loadMoreMarketingVisitsAction(
  offset: number,
  limit: number = 20,
  filterDate?: string,
  isCollection: boolean = false
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi berakhir.', data: [], hasMore: false };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('visits')
      .select(`
        id,
        client_uuid,
        customer_name,
        visit_type,
        product,
        outcome,
        potential_value,
        baki_debet,
        kolektibilitas,
        notes,
        captured_at,
        lat,
        lng,
        accuracy_m,
        address,
        is_late,
        anomaly_flags,
        verification_status,
        verifier_note,
        visit_photos (count)
      `, { count: 'exact' })
      .eq('marketing_id', user.id);

    if (isCollection) {
      query = query.eq('visit_type', 'penagihan');
    } else {
      query = query.neq('visit_type', 'penagihan');
    }

    if (filterDate) {
      const { startUtc, endUtc } = getWIBDayBoundsUtc(filterDate);
      query = query.gte('captured_at', startUtc.toISOString()).lte('captured_at', endUtc.toISOString());
    }

    const from = offset;
    const to = offset + limit - 1;

    const { data, count, error } = await query
      .order('captured_at', { ascending: false })
      .range(from, to);

    if (error) {
      return { error: error.message, data: [], hasMore: false };
    }

    const totalCount = count || 0;
    const hasMore = to + 1 < totalCount;

    return {
      data: data || [],
      totalCount,
      hasMore,
    };
  } catch (err: unknown) {
    console.error('Error in loadMoreMarketingVisitsAction:', err);
    return { error: (err as Error).message, data: [], hasMore: false };
  }
}
