import { NextRequest, NextResponse } from 'next/server';
import { UpdateProgressSchema } from '@polyglot/shared';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = UpdateProgressSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { mediaId, lastPositionSec, lastSegmentIdx, percentComplete, status } = parsed.data;
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('user_media').upsert({
          user_id: user.id,
          media_id: mediaId,
          last_position_sec: lastPositionSec,
          last_segment_idx: lastSegmentIdx,
          percent_complete: percentComplete,
          status,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi lưu tiến độ' },
      { status: 500 }
    );
  }
}
