import { NextRequest, NextResponse } from 'next/server';
import { SaveVocabSchema } from '@polyglot/shared';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = SaveVocabSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu từ vựng không hợp lệ', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { term, translation, context, mediaId, segmentIdx } = parsed.data;
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('vocabulary')
          .insert({
            user_id: user.id,
            term: term.trim(),
            translation: translation.trim(),
            context,
            media_id: mediaId,
            segment_idx: segmentIdx,
            srs_ease: 2.5,
            srs_interval: 1,
            srs_reps: 0,
            due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, item: data });
      }
    }

    // Dev preview mock fallback
    return NextResponse.json({
      success: true,
      item: {
        id: crypto.randomUUID(),
        term,
        translation,
        context,
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi lưu từ vựng' },
      { status: 500 }
    );
  }
}
