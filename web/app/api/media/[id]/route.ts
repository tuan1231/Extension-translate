import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { data: media, error: mediaErr } = await supabase
        .from('media_items')
        .select('*')
        .eq('id', id)
        .single();

      if (mediaErr || !media) {
        return NextResponse.json({ error: 'Không tìm thấy media' }, { status: 404 });
      }

      const { data: transcript } = await supabase
        .from('transcripts')
        .select('*')
        .eq('media_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        media,
        segments: transcript?.segments || [],
      });
    }

    return NextResponse.json({ error: 'Supabase chưa kết nối' }, { status: 404 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi lấy thông tin media' },
      { status: 500 }
    );
  }
}
